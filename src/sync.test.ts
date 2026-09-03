import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  applyMayHaveOverwrittenConcurrentEdit,
  consumeVersionedEcho,
  isEchoDocumentChange,
  planAfterApplyEdit,
  planBeforeApply,
  planWebviewEdit,
  shouldAbortApplyBecauseDocumentMoved,
} from './sync.ts';

describe('planWebviewEdit', () => {
  it('drops edits older than the committed host generation', () => {
    assert.deepEqual(
      planWebviewEdit({
        incomingGeneration: 4,
        sessionGeneration: 5,
        incomingText: 'stale',
        documentText: 'current',
        eol: '\n',
      }),
      { type: 'drop-stale' },
    );
  });

  it('applies a newer generation as a document-eol string', () => {
    assert.deepEqual(
      planWebviewEdit({
        incomingGeneration: 6,
        sessionGeneration: 5,
        incomingText: 'hello\nworld',
        documentText: 'old',
        eol: '\r\n',
      }),
      { type: 'apply', nextText: 'hello\r\nworld' },
    );
  });

  it('no-ops when the document already has the incoming text', () => {
    assert.deepEqual(
      planWebviewEdit({
        incomingGeneration: 2,
        sessionGeneration: 1,
        incomingText: 'same\n',
        documentText: 'same\r\n',
        eol: '\r\n',
      }),
      { type: 'noop' },
    );
  });
});

describe('document-change echo vs unrelated edits', () => {
  it('treats a change matching the just-applied text as an echo', () => {
    assert.equal(isEchoDocumentChange('typed\r\n', 'typed\n'), true);
  });

  it('does not swallow an unrelated external/git edit', () => {
    assert.equal(isEchoDocumentChange('from git', 'typed'), false);
    assert.equal(isEchoDocumentChange('from git', undefined), false);
  });

  it('aborts applyEdit when the document moved after the snapshot', () => {
    assert.equal(shouldAbortApplyBecauseDocumentMoved('typed', 'from git'), true);
    assert.equal(shouldAbortApplyBecauseDocumentMoved('typed\n', 'typed\r\n'), false);
  });
});

describe('planAfterApplyEdit', () => {
  it('on applyEdit false, leaves session generation unchanged and pushes document text', () => {
    assert.deepEqual(
      planAfterApplyEdit({
        applied: false,
        incomingGeneration: 8,
        sessionGeneration: 3,
        intendedText: 'from webview',
        documentText: 'on disk',
      }),
      {
        type: 'failed',
        sessionGeneration: 3,
        pushText: 'on disk',
        pushGeneration: 8,
      },
    );
  });

  it('on success, commits the incoming generation', () => {
    assert.deepEqual(
      planAfterApplyEdit({
        applied: true,
        incomingGeneration: 8,
        sessionGeneration: 3,
        intendedText: 'from webview',
        documentText: 'from webview',
      }),
      { type: 'applied', sessionGeneration: 8 },
    );
  });

  it('on success with a concurrent document mismatch, catch-up with a newer generation', () => {
    assert.deepEqual(
      planAfterApplyEdit({
        applied: true,
        incomingGeneration: 8,
        sessionGeneration: 9,
        intendedText: 'from webview',
        documentText: 'from git',
      }),
      {
        type: 'applied',
        sessionGeneration: 10,
        catchUp: { text: 'from git', generation: 10 },
      },
    );
  });

  it('on success after generation moved, catch-up so a forwarded edit is not left on the webview', () => {
    assert.deepEqual(
      planAfterApplyEdit({
        applied: true,
        incomingGeneration: 5,
        sessionGeneration: 6,
        intendedText: 'from webview',
        documentText: 'from webview',
      }),
      {
        type: 'applied',
        sessionGeneration: 6,
        catchUp: { text: 'from webview', generation: 6 },
      },
    );
  });
});

describe('overlapping generations and undo-shaped document changes', () => {
  it('drops an earlier in-flight generation after a later one has committed', () => {
    const first = planWebviewEdit({
      incomingGeneration: 5,
      sessionGeneration: 4,
      incomingText: 'aaaa',
      documentText: 'old',
      eol: '\n',
    });
    assert.equal(first.type, 'apply');

    const later = planWebviewEdit({
      incomingGeneration: 6,
      sessionGeneration: 5,
      incomingText: 'bbbb',
      documentText: 'aaaa',
      eol: '\n',
    });
    assert.deepEqual(later, { type: 'apply', nextText: 'bbbb' });

    const stale = planWebviewEdit({
      incomingGeneration: 5,
      sessionGeneration: 6,
      incomingText: 'aaaa',
      documentText: 'bbbb',
      eol: '\n',
    });
    assert.equal(stale.type, 'drop-stale');
  });

  it('treats a document undo (text reverted away from lastApplied) as a non-echo', () => {
    assert.equal(isEchoDocumentChange('old contents', 'new contents'), false);
  });

  it('plans a full-document replace for a generated large markdown string', () => {
    const incomingText = `${'# Title\n\n'}${'word '.repeat(220_000)}`;
    assert.ok(incomingText.length >= 1_000_000);
    assert.ok(incomingText.length <= 5_000_000);
    const plan = planWebviewEdit({
      incomingGeneration: 1,
      sessionGeneration: 0,
      incomingText,
      documentText: '',
      eol: '\n',
    });
    assert.equal(plan.type, 'apply');
    if (plan.type === 'apply') {
      assert.equal(plan.nextText.length, incomingText.length);
    }
  });
});

describe('planBeforeApply concurrent external edits', () => {
  it('applies when the live document still matches the snapshot version and text', () => {
    assert.deepEqual(
      planBeforeApply({
        incomingGeneration: 4,
        sessionGeneration: 3,
        incomingText: 'from webview',
        snapshotText: 'A',
        snapshotVersion: 1,
        currentText: 'A',
        currentVersion: 1,
        eol: '\n',
      }),
      { type: 'apply', nextText: 'from webview' },
    );
  });

  it('does not apply when an external edit moved the document before applyEdit', () => {
    const plan = planBeforeApply({
      incomingGeneration: 4,
      sessionGeneration: 3,
      incomingText: 'from webview',
      snapshotText: 'A',
      snapshotVersion: 1,
      currentText: 'from git',
      currentVersion: 2,
      eol: '\n',
    });
    assert.deepEqual(plan, {
      type: 'abort-concurrent',
      sessionGeneration: 3,
      pushText: 'from git',
      pushGeneration: 5,
    });
  });

  it('aborts when the version moved even if the planner snapshot text is reused later', () => {
    const plan = planBeforeApply({
      incomingGeneration: 4,
      sessionGeneration: 3,
      incomingText: 'B',
      snapshotText: 'A',
      snapshotVersion: 1,
      currentText: 'A',
      currentVersion: 3,
      eol: '\n',
    });
    assert.equal(plan.type, 'abort-concurrent');
    if (plan.type === 'abort-concurrent') {
      assert.equal(plan.pushText, 'A');
    }
  });

  it('flags a post-apply version skip that landed our text as a possible overwrite', () => {
    assert.equal(
      applyMayHaveOverwrittenConcurrentEdit({
        snapshotVersion: 1,
        postApplyVersion: 3,
        intendedText: 'from webview',
        postApplyText: 'from webview',
      }),
      true,
    );
    assert.equal(
      applyMayHaveOverwrittenConcurrentEdit({
        snapshotVersion: 1,
        postApplyVersion: 2,
        intendedText: 'from webview',
        postApplyText: 'from webview',
      }),
      false,
    );
  });
});

describe('versioned one-shot echo tickets', () => {
  it('consumes only the exact expected version and then never matches again', () => {
    const ticket = { text: 'B', version: 2 };
    const echo = consumeVersionedEcho(ticket, 'B', 2);
    assert.equal(echo.isEcho, true);
    assert.equal(echo.echo, undefined);
    assert.equal(consumeVersionedEcho(echo.echo, 'B', 2).isEcho, false);
  });

  it('does not ignore a later legitimate A after A→B local then external B→A', () => {
    const afterLocal = consumeVersionedEcho({ text: 'B', version: 2 }, 'B', 2);
    assert.equal(afterLocal.isEcho, true);
    const laterRevert = consumeVersionedEcho(afterLocal.echo, 'A', 3);
    assert.equal(laterRevert.isEcho, false);

    const staleInitMarker = consumeVersionedEcho({ text: 'A', version: 1 }, 'A', 3);
    assert.equal(staleInitMarker.isEcho, false);
  });

  it('does not treat a same-text event at a different version as an echo', () => {
    assert.equal(consumeVersionedEcho({ text: 'hello\n', version: 4 }, 'hello\r\n', 9).isEcho, false);
    assert.equal(isEchoDocumentChange('hello\r\n', 'hello\n'), true);
  });
});
