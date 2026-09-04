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
import { isFindChrome, shouldWindowCloseFind } from './findEscape';
import { CODE_LANGUAGES } from './languages';
import { OutlinePanel } from './OutlinePanel';
import {
  defaultOutlineOpen,
  outlineAutoCollapsed,
  outlineDebounceMs,
  outlinePanelShouldRender,
  outlineTreeFromMarkdown,
  parseOutlineHeadings,
  type OutlineNode,
} from './outline';
import { activeOutlineHeadingFrom, caretInViewport, outlineNavOffset } from './outlineActive';
import { fileToBase64, imageFilesFromDataTransfer, inferImageMime, nextImageRequestId } from './pasteImages';
import {
  applyExternalMarkdown,
  dispatchFormat,
  EXTRA_EXTENSIONS,
  insertSnippetAtSelection,
  isApplyingExternal,
  onDocumentText,
  onEditorViewReady,
  onEditorViewUpdate,
  revealOffset,
} from './sync';
import { Toolbar } from './Toolbar';
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
  const [toolbarEnabled, setToolbarEnabled] = useState(true);
  const [outlineEnabled, setOutlineEnabled] = useState(true);
  const [outlineOpen, setOutlineOpen] = useState(false);
  const [outlineNodes, setOutlineNodes] = useState<OutlineNode[]>([]);
  const [activeHeadingFrom, setActiveHeadingFrom] = useState<number | undefined>();
  const [formatActive, setFormatActive] = useState<FormatActiveMap>({});
  const generationRef = useRef(0);
  const pendingMarkdownRef = useRef<HostMarkdown | undefined>(undefined);
  const imageOptionsRef = useRef<ImageResolveOptions>({});
  const themeSettingRef = useRef<ThemeSetting>('followVscode');
  const readOnlyRef = useRef(false);
  const outlineSourceRef = useRef('');
  const outlineEnabledRef = useRef(true);
  const pendingImages = useRef(new Map<string, true>());
  const shellRef = useRef<HTMLDivElement | null>(null);
  const shellWidthRef = useRef(typeof window === 'undefined' ? 1200 : window.innerWidth);
  const [shellWidth, setShellWidth] = useState(shellWidthRef.current);

  readOnlyRef.current = readOnly;

  useEffect(() => observeTheme(() => themeSettingRef.current), []);

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
      setToolbarEnabled(appearance.toolbarEnabled);
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
          setOutlineNodes(outlineTreeFromMarkdown(mount.text));
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
            setOutlineOpen((open) => {
              if (!open && outlineAutoCollapsed(shellWidthRef.current)) {
                return false;
              }
              return !open;
            });
          }
          break;
        case 'imageSaved':
          pendingImages.current.delete(message.requestId);
          if (!readOnlyRef.current) {
            insertSnippetAtSelection(message.markdown);
          }
          break;
        case 'imageSaveFailed':
          pendingImages.current.delete(message.requestId);
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
    if (!el || typeof ResizeObserver === 'undefined') {
      return;
    }
    const observer = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width;
      if (typeof width !== 'number') {
        return;
      }
      shellWidthRef.current = width;
      setShellWidth(width);
      if (outlineAutoCollapsed(width)) {
        setOutlineOpen(false);
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
        setOutlineNodes(outlineTreeFromMarkdown(text));
      }, outlineDebounceMs(text.length));
    });
    return () => {
      window.clearTimeout(timer);
      unsubscribe();
    };
  }, [session]);

  useEffect(() => {
    return onEditorViewUpdate((current) => {
      const sel = current.state.selection.main;
      const text = current.state.doc.toString();
      const nextActive = detectFormatActive(text, sel.from, sel.to);
      setFormatActive((prev) => (formatActiveEqual(prev, nextActive) ? prev : nextActive));
      const headings = parseOutlineHeadings(outlineSourceRef.current || text);
      let viewportFrom = current.viewport.from;
      try {
        const rect = current.scrollDOM.getBoundingClientRect();
        const pos = current.posAtCoords({ x: rect.left + 16, y: rect.top + 8 });
        if (typeof pos === 'number') {
          viewportFrom = pos;
        }
      } catch {
        // viewport.from is a fine fallback when coords are unavailable
      }
      const pos = outlineNavOffset({
        viewportFrom,
        caret: sel.head,
        caretInView: caretInViewport(sel.head, current.viewport.from, current.viewport.to),
      });
      const headingFrom = activeOutlineHeadingFrom(headings, pos);
      setActiveHeadingFrom((prev) => (prev === headingFrom ? prev : headingFrom));
    });
  }, [session]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') {
        return;
      }
      const handle = editorHandleRef.current;
      if (!handle?.isSearchOpen()) {
        return;
      }
      const target = event.target;
      const inFind = isFindChrome(target instanceof Element ? target : null);
      if (!shouldWindowCloseFind({ searchOpen: true, inFindChrome: inFind })) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      handle.closeSearch();
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
          // Host shows errors for save failures; a read error is silent so clipboard stays intact.
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
    setOutlineOpen((open) => {
      if (!open && outlineAutoCollapsed(shellWidthRef.current)) {
        return false;
      }
      return !open;
    });
  }, []);

  const onOutlineSelect = useCallback(
    (from: number) => {
      revealOffset(from, !readOnlyRef.current);
    },
    [],
  );

  if (!session) {
    return <div className="app" />;
  }

  const showOutline = outlinePanelShouldRender({
    enabled: outlineEnabled,
    open: outlineOpen,
    editorWidthPx: shellWidth,
  });

  return (
    <div className={`app${readOnly ? ' app-reading' : ''}`}>
      {readOnly || toolbarEnabled ? (
        <div className="atomic-chrome">
          {readOnly ? (
            <div className="atomic-reading-chip" role="status">
              Reading
            </div>
          ) : null}
          {toolbarEnabled ? (
            <Toolbar
              readOnly={readOnly}
              outlineOpen={showOutline}
              outlineEnabled={outlineEnabled}
              formatActive={formatActive}
              onFormat={onFormat}
              onToggleOutline={onToggleOutline}
            />
          ) : null}
        </div>
      ) : null}
      <div className="editor-shell" ref={shellRef}>
        {showOutline ? (
          <OutlinePanel nodes={outlineNodes} activeFrom={activeHeadingFrom} onSelect={onOutlineSelect} />
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
    </div>
  );
}
