import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { requestSendToChat, selectionChatPayload, setSendToChatHandler } from './sendToChat.ts';

describe('selectionChatPayload', () => {
  it('slices the CM selection and attaches a comment only in comment mode', () => {
    const view = {
      state: {
        selection: { main: { from: 4, to: 9 } },
        doc: {
          sliceString(from: number, to: number) {
            return 'xxxxhelloyy'.slice(from, to);
          },
        },
      },
    };
    assert.deepEqual(selectionChatPayload(view, 'selection', 'ignored'), {
      mode: 'selection',
      text: 'hello',
      from: 4,
      to: 9,
    });
    assert.deepEqual(selectionChatPayload(view, 'comment', 'please explain'), {
      mode: 'comment',
      text: 'hello',
      from: 4,
      to: 9,
      comment: 'please explain',
    });
  });
});

describe('requestSendToChat', () => {
  it('forwards to the registered host handler', () => {
    const seen: unknown[] = [];
    setSendToChatHandler((request) => {
      seen.push(request);
    });
    assert.equal(
      requestSendToChat({ mode: 'selection', text: 'hi', from: 0, to: 2 }),
      true,
    );
    setSendToChatHandler(undefined);
    assert.equal(requestSendToChat({ mode: 'selection', text: 'hi', from: 0, to: 2 }), false);
    assert.deepEqual(seen, [{ mode: 'selection', text: 'hi', from: 0, to: 2 }]);
  });
});
