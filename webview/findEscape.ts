/**
 * Atomic's find UI is a CM6 search panel (`closeSearch` on the editor handle).
 * Escape must close it when the panel is focused. Ctrl/Cmd+F stays on
 * `atomicMarkdown.find` / `openSearch`.
 */

export function isFindChrome(target: { closest?: (selector: string) => unknown } | null): boolean {
  return Boolean(
    target?.closest?.('.cm-search, .atomic-editor-search-panel, .cm-atomic-search-input'),
  );
}

/** Window capture: steal Escape only while the find field/panel is focused. */
export function shouldWindowCloseFind(input: { searchOpen: boolean; inFindChrome: boolean }): boolean {
  return input.searchOpen && input.inFindChrome;
}

/** CM6 keymap (Prec.high): Escape closes an open search panel. */
export function shouldKeymapCloseFind(searchOpen: boolean): boolean {
  return searchOpen;
}
