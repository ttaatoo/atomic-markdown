import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  isEchoDocumentChange,
  planAfterApplyEdit,
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
