import { createRoot } from 'react-dom/client';
import '@atomic-editor/editor/styles.css';
import { App } from './App';
import { installMermaidErrorIsolation } from './mermaidIsolation';
import { WebviewErrorBoundary } from './WebviewErrorBoundary';
import './theme.css';

installMermaidErrorIsolation();

const root = document.getElementById('root');
if (!root) {
  throw new Error('Atomic Markdown webview is missing #root');
}

createRoot(root).render(
  <WebviewErrorBoundary>
    <App />
  </WebviewErrorBoundary>,
);
