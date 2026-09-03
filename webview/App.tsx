import {
  AtomicCodeMirrorEditor,
  type AtomicCodeMirrorEditorHandle,
} from '@atomic-editor/editor';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { HostToWebview } from '../src/protocol';
import { rewriteImagesIn, type ImageResolveOptions } from './images';
import { CODE_LANGUAGES } from './languages';
import { applyExternalMarkdown, EXTRA_EXTENSIONS, isApplyingExternal } from './sync';
import { observeWorkbenchTheme } from './theme';
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
  const imageOptionsRef = useRef<ImageResolveOptions>({});

  useEffect(() => observeWorkbenchTheme(), []);

  useEffect(() => {
    const onMessage = (event: MessageEvent<HostToWebview>) => {
      const message = event.data;
      if (!message || typeof message !== 'object' || !('type' in message)) {
        return;
      }

      switch (message.type) {
        case 'init': {
          generationRef.current = message.generation;
          const imageOptions = {
            documentDirWebviewUri: message.documentDirWebviewUri,
            workspaceWebviewUri: message.workspaceWebviewUri,
          };
          imageOptionsRef.current = imageOptions;
          setReadOnly(message.readOnly);
          setSession({
            uri: message.uri,
            text: message.text,
            imageOptions,
          });
          break;
        }
        case 'setMarkdown':
          generationRef.current = message.generation;
          applyExternalMarkdown(message.text);
          break;
        case 'setReadOnly':
          setReadOnly(message.readOnly);
          break;
        case 'toggleReadOnly':
          setReadOnly((current) => !current);
          break;
        case 'openSearch':
          editorHandleRef.current?.openSearch();
          break;
      }
    };

    window.addEventListener('message', onMessage);
    vscodeApi.postMessage({ type: 'ready' });
    return () => window.removeEventListener('message', onMessage);
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
