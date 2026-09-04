export type OpenAtomicReason =
  | 'already-active-atomic'
  | 'replace-active-text'
  | 'replace-open-text'
  | 'open-new';

export type OpenAtomicPlan =
  | { type: 'warn'; message: string }
  | { type: 'noop'; reason: 'already-active-atomic' }
  | { type: 'replace'; reason: 'replace-active-text' | 'replace-open-text'; column: number }
  | { type: 'open'; reason: 'open-new' };

export interface OpenAtomicTab {
  kind: 'text' | 'atomic' | 'other';
  isActive: boolean;
  column: number;
}

/**
 * Reopen semantics: Atomic should replace the current/open text tab for this
 * .md, not stack a second same-named tab. Explorer uses the same rule when
 * that file is already open as a text editor.
 */
export function planOpenAtomic(input: {
  hasTarget: boolean;
  isMarkdown: boolean;
  tabs: readonly OpenAtomicTab[];
}): OpenAtomicPlan {
  if (!input.hasTarget) {
    return { type: 'warn', message: 'Open a Markdown (.md) file first.' };
  }
  if (!input.isMarkdown) {
    return { type: 'warn', message: 'Atomic Markdown opens .md files.' };
  }

  const textTabs = input.tabs.filter((tab) => tab.kind === 'text');
  const atomicTabs = input.tabs.filter((tab) => tab.kind === 'atomic');
  const activeText = textTabs.find((tab) => tab.isActive);
  const activeAtomic = atomicTabs.find((tab) => tab.isActive);

  if (activeAtomic && !activeText) {
    return { type: 'noop', reason: 'already-active-atomic' };
  }
  if (activeText) {
    return { type: 'replace', reason: 'replace-active-text', column: activeText.column };
  }
  if (textTabs[0]) {
    return { type: 'replace', reason: 'replace-open-text', column: textTabs[0].column };
  }
  return { type: 'open', reason: 'open-new' };
}

export function isMarkdownPath(path: string): boolean {
  return path.toLowerCase().endsWith('.md');
}
