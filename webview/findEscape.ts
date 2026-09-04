/**
 * Atomic find is CM6's search panel (`openSearch` / `closeSearch` on the handle).
 * Workbench Ctrl/Cmd+F must not win; Escape must close only while find is open.
 */

export function isFindChrome(target: { closest?: (selector: string) => unknown } | null): boolean {
  return Boolean(
    target?.closest?.('.cm-search, .atomic-editor-search-panel, .cm-atomic-search-input'),
  );
}

/** Window capture: close find whenever it is open (focus may be in the input or the editor). */
export function shouldWindowCloseFind(input: { searchOpen: boolean }): boolean {
  return input.searchOpen;
}

/** CM6 keymap (Prec.high): Escape closes an open search panel; otherwise do not consume. */
export function shouldKeymapCloseFind(searchOpen: boolean): boolean {
  return searchOpen;
}

export function isFindOpenShortcut(input: { key: string; ctrlOrMeta: boolean; alt: boolean }): boolean {
  return input.ctrlOrMeta && !input.alt && input.key.toLowerCase() === 'f';
}

export function shouldHostEscapeCloseFind(findOpen: boolean): boolean {
  return findOpen;
}
