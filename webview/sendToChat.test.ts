import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  requestCopyText,
  requestSendToChat,
  selectionChatPayload,
  setCopyTextHandler,
  setSendToChatHandler,
} from './sendToChat.ts';

const view = {
  state: {
    selection: { main: { from: 4, to: 9 } },
    doc: {
      sliceString(from: number, to: number) {
        return 'xxxxhelloyy'.slice(from, to);
      },
      toString() {
        return 'xxxxhelloyy';
      },
    },
  },
};

describe('selectionChatPayload', () => {
  it('sends the selection with an optional comment', () => {
    assert.deepEqual(selectionChatPayload(view, 'selection'), {
      mode: 'selection',
      text: 'hello',
      from: 4,
      to: 9,
    });
    assert.deepEqual(selectionChatPayload(view, 'selection', ''), {
      mode: 'selection',
      text: 'hello',
      from: 4,
      to: 9,
      comment: '',
    });
    assert.deepEqual(selectionChatPayload(view, 'selection', 'please explain'), {
      mode: 'selection',
      text: 'hello',
      from: 4,
      to: 9,
      comment: 'please explain',
    });
  });

  it('uses the full document text for global mode', () => {
    assert.deepEqual(selectionChatPayload(view, 'global', 'note'), {
      mode: 'global',
      text: 'xxxxhelloyy',
      from: 4,
      to: 9,
      comment: 'note',
    });
  });
});

describe('requestSendToChat and requestCopyText', () => {
  it('forwards to the registered host handlers', () => {
    const chats: unknown[] = [];
    const copies: string[] = [];
    setSendToChatHandler((request) => {
      chats.push(request);
    });
    setCopyTextHandler((text) => {
      copies.push(text);
    });
    assert.equal(requestSendToChat({ mode: 'selection', text: 'hi', from: 0, to: 2 }), true);
    assert.equal(requestCopyText('clip'), true);
    setSendToChatHandler(undefined);
    setCopyTextHandler(undefined);
    assert.equal(requestSendToChat({ mode: 'selection', text: 'hi', from: 0, to: 2 }), false);
    assert.equal(requestCopyText('clip'), false);
    assert.deepEqual(chats, [{ mode: 'selection', text: 'hi', from: 0, to: 2 }]);
    assert.deepEqual(copies, ['clip']);
  });
});
