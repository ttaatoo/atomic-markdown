import { Transaction } from '@codemirror/state';
import { EditorView, ViewPlugin, type ViewUpdate } from '@codemirror/view';
import { findEscapeKeymap, findOpenTracker } from './findEscapeKeymap';
import { applyFormat, insertSnippet, type FormatAction } from './format';
import { mermaidBlocks } from './mermaidBlocks';

let view: EditorView | null = null;
let applyingExternal = false;
const viewReadyListeners = new Set<(current: EditorView) => void>();
const documentTextListeners = new Set<(text: string) => void>();
const viewUpdateListeners = new Set<(current: EditorView) => void>();
const scrollListeners = new Set<(current: EditorView) => void>();

export const captureEditorView = ViewPlugin.fromClass(
  class {
    private readonly onScroll: () => void;
    private raf = 0;

    constructor(readonly current: EditorView) {
      view = current;
      this.onScroll = () => {
        if (this.raf) {
          return;
        }
        this.raf = requestAnimationFrame(() => {
          this.raf = 0;
          if (view !== this.current) {
            return;
          }
          for (const listener of scrollListeners) {
            listener(this.current);
          }
        });
      };
      current.scrollDOM.addEventListener('scroll', this.onScroll, { passive: true });
      for (const listener of viewReadyListeners) {
        listener(current);
      }
      const text = current.state.doc.toString();
      for (const listener of documentTextListeners) {
        listener(text);
      }
    }

    update(update: ViewUpdate): void {
      if (update.docChanged) {
        const text = update.state.doc.toString();
        for (const listener of documentTextListeners) {
          listener(text);
        }
      }
      if (update.docChanged || update.selectionSet || update.viewportChanged) {
        for (const listener of viewUpdateListeners) {
          listener(update.view);
        }
      }
    }

    destroy(): void {
      this.current.scrollDOM.removeEventListener('scroll', this.onScroll);
      if (this.raf) {
        cancelAnimationFrame(this.raf);
      }
      if (view === this.current) {
        view = null;
      }
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

export function onDocumentText(listener: (text: string) => void): () => void {
  documentTextListeners.add(listener);
  if (view) {
    listener(view.state.doc.toString());
  }
  return () => {
    documentTextListeners.delete(listener);
  };
}

export function onEditorViewUpdate(listener: (current: EditorView) => void): () => void {
  viewUpdateListeners.add(listener);
  if (view) {
    listener(view);
  }
  return () => {
    viewUpdateListeners.delete(listener);
  };
}

/** Fires on scrollDOM scroll (including moves inside CM6's already-rendered viewport). */
export function onEditorScroll(listener: (current: EditorView) => void): () => void {
  scrollListeners.add(listener);
  if (view) {
    listener(view);
  }
  return () => {
    scrollListeners.delete(listener);
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

export function dispatchFormat(action: FormatAction): boolean {
  if (!view || view.state.readOnly) {
    return false;
  }
  const sel = view.state.selection.main;
  const text = view.state.doc.toString();
  const patch = applyFormat(text, sel.from, sel.to, action);
  view.dispatch({
    changes: { from: patch.replaceFrom, to: patch.replaceTo, insert: patch.insert },
    selection: { anchor: patch.selectionFrom, head: patch.selectionTo },
    scrollIntoView: true,
  });
  view.focus();
  return true;
}

export function insertSnippetAtSelection(snippet: string): boolean {
  if (!view || view.state.readOnly) {
    return false;
  }
  const sel = view.state.selection.main;
  const text = view.state.doc.toString();
  const patch = insertSnippet(text, sel.from, sel.to, snippet);
  view.dispatch({
    changes: { from: patch.replaceFrom, to: patch.replaceTo, insert: patch.insert },
    selection: { anchor: patch.selectionFrom, head: patch.selectionTo },
    scrollIntoView: true,
  });
  view.focus();
  return true;
}

export function revealOffset(offset: number, moveCaret: boolean): boolean {
  if (!view) {
    return false;
  }
  const pos = Math.max(0, Math.min(offset, view.state.doc.length));
  if (moveCaret) {
    view.dispatch({
      selection: { anchor: pos },
      scrollIntoView: true,
    });
    view.focus();
  } else {
    view.dispatch({
      effects: EditorView.scrollIntoView(pos, { y: 'start' }),
    });
  }
  return true;
}

export const EXTRA_EXTENSIONS = [captureEditorView, mermaidBlocks(), findEscapeKeymap(), findOpenTracker];
