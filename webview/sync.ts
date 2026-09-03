import { Transaction } from '@codemirror/state';
import { EditorView, ViewPlugin } from '@codemirror/view';
import { mermaidBlocks } from './mermaidBlocks';

let view: EditorView | null = null;
let applyingExternal = false;
const viewReadyListeners = new Set<(current: EditorView) => void>();

export const captureEditorView = ViewPlugin.fromClass(
  class {
    constructor(current: EditorView) {
      view = current;
      for (const listener of viewReadyListeners) {
        listener(current);
      }
    }

    destroy(): void {
      view = null;
    }
  },
);

export function onEditorViewReady(listener: (current: EditorView) => void): () => void {
  viewReadyListeners.add(listener);
  if (view) {
    listener(view);
  }
  return () => {
    viewReadyListeners.delete(listener);
  };
}

/** @returns false when the view is not mounted — caller must keep the payload. */
export function applyExternalMarkdown(text: string): boolean {
  if (!view) {
    return false;
  }
  if (view.state.doc.toString() === text) {
    return true;
  }

  applyingExternal = true;
  try {
    view.dispatch({
      changes: { from: 0, to: view.state.doc.length, insert: text },
      annotations: [Transaction.addToHistory.of(false)],
    });
  } finally {
    applyingExternal = false;
  }
  return true;
}

export function isApplyingExternal(): boolean {
  return applyingExternal;
}

export const EXTRA_EXTENSIONS = [captureEditorView, mermaidBlocks()];
