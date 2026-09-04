import { closeSearchPanel, searchPanelOpen } from '@codemirror/search';
import { Prec } from '@codemirror/state';
import { keymap, type EditorView } from '@codemirror/view';
import { shouldKeymapCloseFind } from './findEscape.ts';

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
