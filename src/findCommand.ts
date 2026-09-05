/**
 * Host-side find routing. The webview must be focused so openSearch lands,
 * and Escape is only claimed while Atomic find is open.
 */
export function planFindInEditor(hasActiveSession: boolean): {
  focusWebview: boolean;
  post: 'openSearch' | null;
} {
  if (!hasActiveSession) {
    return { focusWebview: false, post: null };
  }
  return { focusWebview: true, post: 'openSearch' };
}

export function planCloseFind(hasActiveSession: boolean): { post: 'closeSearch' | null } {
  return { post: hasActiveSession ? 'closeSearch' : null };
}

export const FIND_WHEN =
  'activeCustomEditorId == ttaatoo.atomicMarkdown && !editorTextFocus';
export const FIND_WHEN_WEBVIEW =
  'activeCustomEditorId == ttaatoo.atomicMarkdown && webviewFocus';
export const FIND_WHEN_ACTIVE = 'activeCustomEditorId == ttaatoo.atomicMarkdown';
export const CLOSE_FIND_WHEN =
  'activeCustomEditorId == ttaatoo.atomicMarkdown && atomicMarkdown.findOpen';
