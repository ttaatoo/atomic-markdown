import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { isFormatAction, isSendToChatMessage } from './protocol.ts';

describe('isFormatAction', () => {
  it('accepts known formatting actions only', () => {
    assert.equal(isFormatAction('bold'), true);
    assert.equal(isFormatAction('strike'), true);
    assert.equal(isFormatAction('heading'), true);
    assert.equal(isFormatAction('taskList'), true);
    assert.equal(isFormatAction('underline'), false);
    assert.equal(isFormatAction(undefined), false);
  });
});

describe('isSendToChatMessage', () => {
  it('accepts selection and comment payloads', () => {
    assert.equal(
      isSendToChatMessage({
        type: 'sendToChat',
        mode: 'selection',
        text: 'Raw markdown is the source of truth.',
        from: 10,
        to: 46,
      }),
      true,
    );
    assert.equal(
      isSendToChatMessage({
        type: 'sendToChat',
        mode: 'comment',
        text: 'hello',
        from: 0,
        to: 5,
        comment: 'why this?',
      }),
      true,
    );
  });

  it('rejects malformed chat messages', () => {
    assert.equal(isSendToChatMessage({ type: 'sendToChat', mode: 'selection' }), false);
    assert.equal(isSendToChatMessage({ type: 'edit', text: 'x', generation: 1 }), false);
    assert.equal(
      isSendToChatMessage({
        type: 'sendToChat',
        mode: 'other',
        text: 'x',
        from: 0,
        to: 1,
      }),
      false,
    );
  });
});
