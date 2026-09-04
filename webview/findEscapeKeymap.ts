import { closeSearchPanel, searchPanelOpen } from '@codemirror/search';
import { Prec } from '@codemirror/state';
import { EditorView, keymap } from '@codemirror/view';
import { shouldKeymapCloseFind } from './findEscape.ts';

const findOpenListeners = new Set<(open: boolean) => void>();
let lastFindOpen: boolean | undefined;

export const findOpenTracker = EditorView.updateListener.of((update) => {
  const open = searchPanelOpen(update.state);
  if (open === lastFindOpen) {
    return;
  }
  lastFindOpen = open;
  for (const listener of findOpenListeners) {
    listener(open);
  }
});

export function onFindOpenChange(listener: (open: boolean) => void): () => void {
  findOpenListeners.add(listener);
  if (lastFindOpen !== undefined) {
    listener(lastFindOpen);
  }
  return () => {
    findOpenListeners.delete(listener);
  };
}

export function runFindEscape(view: EditorView): boolean {
  if (!shouldKeymapCloseFind(searchPanelOpen(view.state))) {
    return false;
  }
  return closeSearchPanel(view);
}

/** Prec.high so Escape reaches the find panel even when other keys are bound. */
export function findEscapeKeymap() {
  return Prec.high(
    keymap.of([
      {
        key: 'Escape',
        run: runFindEscape,
      },
    ]),
  );
}
