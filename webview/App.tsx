import {
  AtomicCodeMirrorEditor,
  type AtomicCodeMirrorEditorHandle,
} from '@atomic-editor/editor';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { AppearanceSettings } from '../src/appearance.ts';
import type { FormatAction, HostToWebview } from '../src/protocol';
import { markdownForMount, takeNewerMarkdown, type HostMarkdown } from './hostMarkdown';
import { rewriteImagesIn, type ImageResolveOptions } from './images';
import { detectFormatActive, formatActiveEqual, type FormatActiveMap } from './formatActive';
import { isFindOpenShortcut, shouldWindowCloseFind } from './findEscape';
import { onFindOpenChange } from './findEscapeKeymap';
import { CODE_LANGUAGES } from './languages';
import { OutlinePanel } from './OutlinePanel';
import {
  defaultOutlineOpen,
  outlineDebounceMs,
  outlinePlacement,
  outlineTreeFromMarkdown,
  outlineUsesOverlay,
  parseOutlineHeadings,
  pruneCollapsedFroms,
  shouldWindowCloseOutlineOverlay,
  toggleCollapsedFrom,
  type OutlineNode,
} from './outline';
import { hostFailureNotice } from './notices';
import { headingAtScrollPosition, visibleTopDocPos } from './outlineActive';
import { fileToBase64, imageFilesFromDataTransfer, inferImageMime, nextImageRequestId } from './pasteImages';
import { SelectionFormatBar } from './SelectionFormatBar';
import {
  SELECTION_BAR_FALLBACK_HEIGHT,
  SELECTION_BAR_FALLBACK_WIDTH,
  selectionBarFromCoords,
  type SelectionBarBox,
} from './selectionBar';
import {
  applyExternalMarkdown,
  currentEditorView,
  dispatchFormat,
  EXTRA_EXTENSIONS,
  insertSnippetAtSelection,
  isApplyingExternal,
  onDocumentText,
  onEditorScroll,
  onEditorViewReady,
  onEditorViewUpdate,
  revealOffset,
} from './sync';
import { applyAppearance, applyThemeSetting, observeTheme } from './theme';
import { parseThemeSetting, type ThemeSetting } from '../src/themeSetting.ts';
import { vscodeApi } from './vscodeApi';

interface EditorSession {
  uri: string;
  text: string;
  imageOptions: ImageResolveOptions;
}

export function App() {
  const editorHandleRef = useRef<AtomicCodeMirrorEditorHandle | null>(null);
  const [session, setSession] = useState<EditorSession | null>(null);
  const [readOnly, setReadOnly] = useState(false);
  const [outlineEnabled, setOutlineEnabled] = useState(true);
  const [outlineOpen, setOutlineOpen] = useState(false);
  const [notice, setNotice] = useState<string | undefined>();
  const [outlineNodes, setOutlineNodes] = useState<OutlineNode[]>([]);
  const [collapsedFroms, setCollapsedFroms] = useState<Set<number>>(() => new Set());
  const [activeHeadingFrom, setActiveHeadingFrom] = useState<number | undefined>();
  const [formatActive, setFormatActive] = useState<FormatActiveMap>({});
  const [selectionBar, setSelectionBar] = useState<SelectionBarBox | null>(null);
  const generationRef = useRef(0);
  const pendingMarkdownRef = useRef<HostMarkdown | undefined>(undefined);
  const imageOptionsRef = useRef<ImageResolveOptions>({});
  const themeSettingRef = useRef<ThemeSetting>('followVscode');
  const readOnlyRef = useRef(false);
  const outlineSourceRef = useRef('');
  const outlineEnabledRef = useRef(true);
  const outlineOpenRef = useRef(false);
  const pendingImages = useRef(new Map<string, true>());
  const shellRef = useRef<HTMLDivElement | null>(null);
  const shellWidthRef = useRef(0);
  const [shellWidth, setShellWidth] = useState(0);
  const pointerOnBarRef = useRef(false);
  const selectionBarElRef = useRef<HTMLDivElement | null>(null);

  readOnlyRef.current = readOnly;
  outlineOpenRef.current = outlineOpen;

  useEffect(() => observeTheme(() => themeSettingRef.current), []);

  useEffect(() => {
    const id = window.requestAnimationFrame(() => {
      document.documentElement.classList.add('transitions-ready');
    });
    return () => window.cancelAnimationFrame(id);
  }, []);

  useEffect(() => {
    const flushPending = () => {
      const pending = pendingMarkdownRef.current;
      if (!pending) {
        return;
      }
      if (pending.generation < generationRef.current) {
        pendingMarkdownRef.current = undefined;
        return;
      }
      if (applyExternalMarkdown(pending.text)) {
        pendingMarkdownRef.current = undefined;
      }
    };

    const unsubscribeView = onEditorViewReady(flushPending);

    const applyHostAppearance = (appearance: AppearanceSettings) => {
      themeSettingRef.current = parseThemeSetting(appearance.theme);
      applyAppearance(appearance);
      outlineEnabledRef.current = appearance.outlineEnabled;
      setOutlineEnabled(appearance.outlineEnabled);
      setOutlineOpen((open) => (appearance.outlineEnabled ? open : false));
    };

    const onMessage = (event: MessageEvent<HostToWebview>) => {
      const message = event.data;
      if (!message || typeof message !== 'object' || !('type' in message)) {
        return;
      }

      switch (message.type) {
        case 'init': {
          const imageOptions = {
            documentDirWebviewUri: message.documentDirWebviewUri,
            workspaceWebviewUri: message.workspaceWebviewUri,
          };
          imageOptionsRef.current = imageOptions;
          const mount = markdownForMount(
            { text: message.text, generation: message.generation },
            pendingMarkdownRef.current,
          );
          generationRef.current = mount.generation;
          pendingMarkdownRef.current = undefined;
          setReadOnly(message.readOnly);
          applyHostAppearance(message.appearance);
          const wide = typeof matchMedia === 'function' && matchMedia('(min-width: 900px)').matches;
          setOutlineOpen(defaultOutlineOpen(message.appearance.outlineEnabled, wide));
          outlineSourceRef.current = mount.text;
          const tree = outlineTreeFromMarkdown(mount.text);
          setOutlineNodes(tree);
          setCollapsedFroms((prev) => pruneCollapsedFroms(prev, tree));
          setSession({
            uri: message.uri,
            text: mount.text,
            imageOptions,
          });
          break;
        }
        case 'setMarkdown': {
          const incoming: HostMarkdown = { text: message.text, generation: message.generation };
          const next = takeNewerMarkdown(pendingMarkdownRef.current, incoming, generationRef.current);
          if (!next || next !== incoming) {
            break;
          }
          generationRef.current = incoming.generation;
          pendingMarkdownRef.current = incoming;
          outlineSourceRef.current = incoming.text;
          if (applyExternalMarkdown(incoming.text)) {
            pendingMarkdownRef.current = undefined;
          }
          break;
        }
        case 'setReadOnly':
          setReadOnly(message.readOnly);
          break;
        case 'toggleReadOnly':
          setReadOnly((current) => !current);
          break;
        case 'openSearch':
          editorHandleRef.current?.openSearch();
          break;
        case 'closeSearch':
          editorHandleRef.current?.closeSearch();
          break;
        case 'setTheme':
          themeSettingRef.current = parseThemeSetting(message.theme);
          applyThemeSetting(themeSettingRef.current);
          break;
        case 'setAppearance':
          applyHostAppearance(message.appearance);
          break;
        case 'format':
          if (!readOnlyRef.current) {
            dispatchFormat(message.action);
          }
          break;
        case 'toggleOutline':
          if (outlineEnabledRef.current) {
            setOutlineOpen((open) => !open);
          }
          break;
        case 'imageSaved':
          pendingImages.current.delete(message.requestId);
          setNotice(undefined);
          if (!readOnlyRef.current) {
            insertSnippetAtSelection(message.markdown);
          }
          break;
        case 'imageSaveFailed':
          pendingImages.current.delete(message.requestId);
          setNotice(hostFailureNotice(message.message));
          break;
      }
    };

    window.addEventListener('message', onMessage);
    vscodeApi.postMessage({ type: 'ready' });
    return () => {
      unsubscribeView();
      window.removeEventListener('message', onMessage);
    };
  }, []);

  useEffect(() => {
    if (!session) {
      return;
    }
    vscodeApi.postMessage({ type: 'readOnlyChanged', readOnly });
  }, [readOnly, session]);

  useEffect(() => {
    if (readOnly) {
      setSelectionBar(null);
    }
  }, [readOnly]);

  useEffect(() => {
    const root = document.getElementById('root');
    if (!root) {
      return;
    }

    const rewrite = () => rewriteImagesIn(root, imageOptionsRef.current);
    rewrite();

    const observer = new MutationObserver(rewrite);
    observer.observe(root, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ['src'],
    });
    return () => observer.disconnect();
  }, [session]);

  useEffect(() => {
    const el = shellRef.current;
    if (!el) {
      return;
    }
    const applyWidth = (width: number) => {
      if (!Number.isFinite(width) || width <= 0) {
        return;
      }
      if (Math.abs(width - shellWidthRef.current) < 0.5) {
        return;
      }
      shellWidthRef.current = width;
      setShellWidth(width);
    };
    applyWidth(el.getBoundingClientRect().width);
    if (typeof ResizeObserver === 'undefined') {
      return;
    }
    const observer = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width;
      if (typeof width === 'number') {
        applyWidth(width);
      }
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [session]);

  useEffect(() => {
    let timer: number | undefined;
    const unsubscribe = onDocumentText((text) => {
      outlineSourceRef.current = text;
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        const tree = outlineTreeFromMarkdown(text);
        setOutlineNodes(tree);
        setCollapsedFroms((prev) => pruneCollapsedFroms(prev, tree));
      }, outlineDebounceMs(text.length));
    });
    return () => {
      window.clearTimeout(timer);
      unsubscribe();
    };
  }, [session]);

  useEffect(() => {
    const syncOutline = (current: Parameters<typeof visibleTopDocPos>[0] & { state: { doc: { toString(): string } } }) => {
      const headings = parseOutlineHeadings(outlineSourceRef.current || current.state.doc.toString());
      const headingFrom = headingAtScrollPosition(headings, visibleTopDocPos(current));
      setActiveHeadingFrom((prev) => (prev === headingFrom ? prev : headingFrom));
    };
    const syncSelectionBar = (current: Parameters<typeof visibleTopDocPos>[0] & {
      hasFocus: boolean;
      coordsAtPos(pos: number): { top: number; bottom: number; left: number; right: number } | null;
      state: { selection: { main: { from: number; to: number; empty: boolean } }; doc: { toString(): string } };
    }) => {
      const sel = current.state.selection.main;
      const nextActive = detectFormatActive(current.state.doc.toString(), sel.from, sel.to);
      setFormatActive((prev) => (formatActiveEqual(prev, nextActive) ? prev : nextActive));
      const barEl = selectionBarElRef.current;
      const next = selectionBarFromCoords(
        {
          readOnly: readOnlyRef.current,
          selectionEmpty: sel.empty,
          editorFocused: current.hasFocus,
          pointerOnBar: pointerOnBarRef.current,
        },
        current.coordsAtPos(sel.from),
        current.coordsAtPos(sel.to),
        { width: window.innerWidth, height: window.innerHeight },
        {
          width: barEl?.offsetWidth || SELECTION_BAR_FALLBACK_WIDTH,
          height: barEl?.offsetHeight || SELECTION_BAR_FALLBACK_HEIGHT,
        },
      );
      setSelectionBar((prev) => {
        if (!next && !prev) {
          return prev;
        }
        if (next && prev && Math.abs(next.top - prev.top) < 0.5 && Math.abs(next.left - prev.left) < 0.5) {
          return prev;
        }
        return next;
      });
    };
    const unsubUpdate = onEditorViewUpdate((current) => {
      syncOutline(current);
      syncSelectionBar(current);
    });
    const unsubScroll = onEditorScroll((current) => {
      syncOutline(current);
      syncSelectionBar(current);
    });
    const onResize = () => {
      const current = currentEditorView();
      if (current) {
        syncSelectionBar(current);
      }
    };
    const onFocusChange = () => {
      const current = currentEditorView();
      if (current) {
        syncSelectionBar(current);
      }
    };
    window.addEventListener('resize', onResize);
    window.addEventListener('focusin', onFocusChange);
    window.addEventListener('focusout', onFocusChange);
    return () => {
      unsubUpdate();
      unsubScroll();
      window.removeEventListener('resize', onResize);
      window.removeEventListener('focusin', onFocusChange);
      window.removeEventListener('focusout', onFocusChange);
    };
  }, [session]);

  useEffect(() => {
    return onFindOpenChange((open) => {
      vscodeApi.postMessage({ type: 'findOpenChanged', open });
    });
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (isFindOpenShortcut({ key: event.key, ctrlOrMeta: event.ctrlKey || event.metaKey, alt: event.altKey })) {
        event.preventDefault();
        event.stopPropagation();
        editorHandleRef.current?.openSearch();
        return;
      }
      if (event.key !== 'Escape') {
        return;
      }
      const handle = editorHandleRef.current;
      if (handle && shouldWindowCloseFind({ searchOpen: handle.isSearchOpen() })) {
        event.preventDefault();
        event.stopPropagation();
        handle.closeSearch();
        return;
      }
      if (
        shouldWindowCloseOutlineOverlay({
          findOpen: Boolean(handle?.isSearchOpen()),
          overlayOpen: outlineOpenRef.current && outlineUsesOverlay(shellWidthRef.current),
        })
      ) {
        event.preventDefault();
        event.stopPropagation();
        setOutlineOpen(false);
      }
    };
    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, []);

  useEffect(() => {
    const saveFiles = async (files: File[]) => {
      if (readOnlyRef.current || files.length === 0) {
        return;
      }
      for (const file of files) {
        const mime = inferImageMime(file.type, file.name);
        if (!mime) {
          continue;
        }
        try {
          const base64 = await fileToBase64(file);
          const requestId = nextImageRequestId();
          pendingImages.current.set(requestId, true);
          vscodeApi.postMessage({
            type: 'saveImage',
            requestId,
            mime,
            basename: file.name || undefined,
            base64,
          });
        } catch {
          setNotice(hostFailureNotice("Couldn't read that image from the clipboard."));
        }
      }
    };

    const onPaste = (event: ClipboardEvent) => {
      if (readOnlyRef.current) {
        return;
      }
      const files = imageFilesFromDataTransfer(event.clipboardData);
      if (files.length === 0) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      void saveFiles(files);
    };

    const onDrop = (event: DragEvent) => {
      if (readOnlyRef.current) {
        return;
      }
      const files = imageFilesFromDataTransfer(event.dataTransfer);
      if (files.length === 0) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      void saveFiles(files);
    };

    const onDragOver = (event: DragEvent) => {
      if (readOnlyRef.current) {
        return;
      }
      if (imageFilesFromDataTransfer(event.dataTransfer).length === 0) {
        return;
      }
      event.preventDefault();
      if (event.dataTransfer) {
        event.dataTransfer.dropEffect = 'copy';
      }
    };

    window.addEventListener('paste', onPaste, true);
    window.addEventListener('drop', onDrop, true);
    window.addEventListener('dragover', onDragOver, true);
    return () => {
      window.removeEventListener('paste', onPaste, true);
      window.removeEventListener('drop', onDrop, true);
      window.removeEventListener('dragover', onDragOver, true);
    };
  }, []);

  const onMarkdownChange = useCallback((text: string) => {
    if (isApplyingExternal()) {
      return;
    }
    outlineSourceRef.current = text;
    generationRef.current += 1;
    vscodeApi.postMessage({ type: 'edit', text, generation: generationRef.current });
  }, []);

  const onLinkClick = useCallback((url: string) => {
    vscodeApi.postMessage({ type: 'openLink', href: url });
  }, []);

  const onFormat = useCallback((action: FormatAction) => {
    if (!readOnlyRef.current) {
      dispatchFormat(action);
    }
  }, []);

  const onToggleOutline = useCallback(() => {
    setOutlineOpen((open) => !open);
  }, []);

  const onOutlineSelect = useCallback((from: number) => {
    revealOffset(from, !readOnlyRef.current);
  }, []);

  const onToggleOutlineNode = useCallback((from: number) => {
    setCollapsedFroms((prev) => toggleCollapsedFrom(prev, from));
  }, []);

  if (!session) {
    return <div className="app" />;
  }

  const placement = outlinePlacement({
    enabled: outlineEnabled,
    open: outlineOpen,
    editorWidthPx: shellWidth,
  });
  const showOutline = placement.show;
  const outlineOverlay = placement.mount === 'overlay';
  const outlineCollapsed = placement.show && !placement.expanded;

  return (
    <div className={`app${readOnly ? ' app-reading' : ''}`}>
      {notice ? (
        <div className="atomic-notice" role="alert">
          <p className="atomic-notice-text">{notice}</p>
          <button type="button" className="atomic-notice-dismiss" onClick={() => setNotice(undefined)}>
            Dismiss
          </button>
        </div>
      ) : null}
      <div className={`editor-frame${outlineOverlay ? ' outline-overlay' : ''}`} ref={shellRef}>
        <div className="editor-shell">
          {showOutline && !outlineOverlay ? (
            <OutlinePanel
              nodes={outlineNodes}
              activeFrom={activeHeadingFrom}
              collapsed={outlineCollapsed}
              collapsedFroms={collapsedFroms}
              onSelect={onOutlineSelect}
              onToggleSidebar={onToggleOutline}
              onToggleNode={onToggleOutlineNode}
            />
          ) : null}
          <AtomicCodeMirrorEditor
            documentId={session.uri}
            markdownSource={session.text}
            readOnly={readOnly}
            onMarkdownChange={onMarkdownChange}
            onLinkClick={onLinkClick}
            editorHandleRef={editorHandleRef}
            codeLanguages={CODE_LANGUAGES}
            extensions={EXTRA_EXTENSIONS}
          />
        </div>
        {outlineOverlay ? (
          <button
            type="button"
            className="outline-backdrop"
            aria-label="Hide outline"
            onClick={() => setOutlineOpen(false)}
          />
        ) : null}
        {outlineOverlay ? (
          <OutlinePanel
            nodes={outlineNodes}
            activeFrom={activeHeadingFrom}
            overlay
            collapsedFroms={collapsedFroms}
            onSelect={onOutlineSelect}
            onToggleSidebar={onToggleOutline}
            onToggleNode={onToggleOutlineNode}
          />
        ) : null}
      </div>
      {selectionBar && !readOnly ? (
        <SelectionFormatBar
          top={selectionBar.top}
          left={selectionBar.left}
          barRef={selectionBarElRef}
          formatActive={formatActive}
          onFormat={onFormat}
          onPointerEnter={() => {
            pointerOnBarRef.current = true;
          }}
          onPointerLeave={() => {
            pointerOnBarRef.current = false;
          }}
        />
      ) : null}
    </div>
  );
}
