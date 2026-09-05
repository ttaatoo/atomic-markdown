import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { isMarkdownPath, planOpenAtomic } from './openEditorPlan.ts';

describe('planOpenAtomic', () => {
  it('warns without a markdown target', () => {
    assert.deepEqual(planOpenAtomic({ hasTarget: false, isMarkdown: false, tabs: [] }), {
      type: 'warn',
      message: 'Open a Markdown (.md) file first.',
    });
    assert.deepEqual(planOpenAtomic({ hasTarget: true, isMarkdown: false, tabs: [] }), {
      type: 'warn',
      message: 'Atomic Markdown opens .md files.',
    });
  });

  it('replaces the active text tab instead of stacking Atomic', () => {
    assert.deepEqual(
      planOpenAtomic({
        hasTarget: true,
        isMarkdown: true,
        tabs: [{ kind: 'text', isActive: true, column: 1 }],
      }),
      { type: 'replace', reason: 'replace-active-text', column: 1 },
    );
  });

  it('reopens in place when explorer targets a file already open as text', () => {
    assert.deepEqual(
      planOpenAtomic({
        hasTarget: true,
        isMarkdown: true,
        tabs: [{ kind: 'text', isActive: false, column: 2 }],
      }),
      { type: 'replace', reason: 'replace-open-text', column: 2 },
    );
  });

  it('opens normally when the file is not already a text tab', () => {
    assert.deepEqual(planOpenAtomic({ hasTarget: true, isMarkdown: true, tabs: [] }), {
      type: 'open',
      reason: 'open-new',
    });
  });

  it('does not stack another Atomic tab when Atomic is already active', () => {
    assert.deepEqual(
      planOpenAtomic({
        hasTarget: true,
        isMarkdown: true,
        tabs: [{ kind: 'atomic', isActive: true, column: 1 }],
      }),
      { type: 'noop', reason: 'already-active-atomic' },
    );
  });

  it('prefers replacing the active text tab over an existing Atomic split', () => {
    assert.deepEqual(
      planOpenAtomic({
        hasTarget: true,
        isMarkdown: true,
        tabs: [
          { kind: 'atomic', isActive: false, column: 1 },
          { kind: 'text', isActive: true, column: 2 },
        ],
      }),
      { type: 'replace', reason: 'replace-active-text', column: 2 },
    );
  });
});

describe('isMarkdownPath', () => {
  it('matches .md case-insensitively', () => {
    assert.equal(isMarkdownPath('/notes/a.md'), true);
    assert.equal(isMarkdownPath('/notes/A.MD'), true);
    assert.equal(isMarkdownPath('/notes/a.txt'), false);
  });
});
