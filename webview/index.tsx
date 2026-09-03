import { createRoot } from 'react-dom/client';
import '@atomic-editor/editor/styles.css';
import { App } from './App';
import './theme.css';

const root = document.getElementById('root');
if (!root) {
  throw new Error('Atomic Markdown webview is missing #root');
}

createRoot(root).render(<App />);
