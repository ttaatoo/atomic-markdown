import { Transaction } from '@codemirror/state';
import { EditorView, ViewPlugin } from '@codemirror/view';

let view: EditorView | null = null;
let applyingExternal = false;

export const captureEditorView = ViewPlugin.fromClass(
  class {
    constructor(current: EditorView) {
      view = current;
    }

    destroy(): void {
      view = null;
    }
  },
);

export function applyExternalMarkdown(text: string): void {
  if (!view) {
    return;
  }
  if (view.state.doc.toString() === text) {
    return;
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
}

export function isApplyingExternal(): boolean {
  return applyingExternal;
}

export const EXTRA_EXTENSIONS = [captureEditorView];
