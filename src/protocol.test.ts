import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  isCopyDocumentMessage,
  isCopyTextMessage,
  isDocumentCopiedMessage,
  isFormatAction,
  isSendToChatMessage,
} from './protocol.ts';

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
  it('accepts selection, comment, and global payloads (empty comment ok)', () => {
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
    assert.equal(
      isSendToChatMessage({
        type: 'sendToChat',
        mode: 'global',
        text: '# Hi\n',
        from: 0,
        to: 0,
        comment: '',
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

describe('isCopyTextMessage', () => {
  it('accepts a string payload and rejects malformed messages', () => {
    assert.equal(isCopyTextMessage({ type: 'copyText', text: 'hello' }), true);
    assert.equal(isCopyTextMessage({ type: 'copyText', text: '' }), true);
    assert.equal(isCopyTextMessage({ type: 'copyText' }), false);
    assert.equal(isCopyTextMessage({ type: 'sendToChat', text: 'hello' }), false);
  });
});

describe('copyDocument protocol', () => {
  it('accepts a payload-less copyDocument request', () => {
    assert.equal(isCopyDocumentMessage({ type: 'copyDocument' }), true);
    assert.equal(isCopyDocumentMessage({ type: 'copyText', text: 'no' }), false);
    assert.equal(isCopyDocumentMessage({ type: 'copyDocument', text: 'ignored' }), true);
  });

  it('accepts documentCopied success and failure acks', () => {
    assert.equal(isDocumentCopiedMessage({ type: 'documentCopied', ok: true }), true);
    assert.equal(
      isDocumentCopiedMessage({ type: 'documentCopied', ok: false, message: "Couldn't copy the document." }),
      true,
    );
    assert.equal(isDocumentCopiedMessage({ type: 'documentCopied' }), false);
    assert.equal(isDocumentCopiedMessage({ type: 'documentCopied', ok: 'yes' }), false);
  });
});
