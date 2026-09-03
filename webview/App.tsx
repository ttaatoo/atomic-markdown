import {
  AtomicCodeMirrorEditor,
  type AtomicCodeMirrorEditorHandle,
} from '@atomic-editor/editor';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { HostToWebview } from '../src/protocol';
import { markdownForMount, takeNewerMarkdown, type HostMarkdown } from './hostMarkdown';
import { rewriteImagesIn, type ImageResolveOptions } from './images';
import { CODE_LANGUAGES } from './languages';
import {
  applyExternalMarkdown,
  EXTRA_EXTENSIONS,
  isApplyingExternal,
  onEditorViewReady,
} from './sync';
import { parseThemeSetting, type ThemeSetting } from '../src/themeSetting.ts';
import { applyThemeSetting, observeTheme } from './theme';
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
  const generationRef = useRef(0);
  const pendingMarkdownRef = useRef<HostMarkdown | undefined>(undefined);
  const imageOptionsRef = useRef<ImageResolveOptions>({});
  const themeSettingRef = useRef<ThemeSetting>('followVscode');

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
          themeSettingRef.current = parseThemeSetting(message.theme);
          applyThemeSetting(themeSettingRef.current);
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

  const onMarkdownChange = useCallback((text: string) => {
    if (isApplyingExternal()) {
      return;
    }
    generationRef.current += 1;
    vscodeApi.postMessage({ type: 'edit', text, generation: generationRef.current });
  }, []);

  const onLinkClick = useCallback((url: string) => {
    vscodeApi.postMessage({ type: 'openLink', href: url });
  }, []);

  if (!session) {
    return <div className="app" />;
  }

  return (
    <div className="app">
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
  );
}
