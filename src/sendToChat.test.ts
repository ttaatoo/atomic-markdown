import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  CHAT_FALLBACK_NEW_COMMAND,
  CHAT_FALLBACK_PASTE_COMMAND,
  CHAT_OPEN_COMMAND,
  buildChatPrompt,
  lineRangeFromLfOffsets,
  openCursorChat,
  planSendToChat,
} from './sendToChat.ts';

describe('lineRangeFromLfOffsets', () => {
  const doc = 'alpha\nbeta\ngamma\n';

  it('maps a mid-line span to 1-based lines', () => {
    assert.deepEqual(lineRangeFromLfOffsets(doc, 0, 5), { startLine: 1, endLine: 1 });
    assert.deepEqual(lineRangeFromLfOffsets(doc, 6, 10), { startLine: 2, endLine: 2 });
    assert.deepEqual(lineRangeFromLfOffsets(doc, 0, 10), { startLine: 1, endLine: 2 });
  });

  it('treats an exclusive trailing newline as the previous line', () => {
    assert.deepEqual(lineRangeFromLfOffsets(doc, 0, 6), { startLine: 1, endLine: 1 });
    assert.deepEqual(lineRangeFromLfOffsets(doc, 0, doc.length), { startLine: 1, endLine: 3 });
  });

  it('normalizes CRLF source to the same lines as LF offsets', () => {
    const crlf = 'alpha\r\nbeta\r\ngamma\r\n';
    assert.deepEqual(lineRangeFromLfOffsets(crlf, 0, 5), { startLine: 1, endLine: 1 });
    assert.deepEqual(lineRangeFromLfOffsets(crlf, 6, 10), { startLine: 2, endLine: 2 });
  });
});

describe('buildChatPrompt', () => {
  it('omits the Comment section for Add to Chat', () => {
    const prompt = buildChatPrompt({
      path: 'samples/welcome.md',
      startLine: 10,
      endLine: 10,
      text: 'Raw markdown is the source of truth.',
    });
    assert.equal(
      prompt,
      [
        'File: samples/welcome.md:10-10',
        '',
        '```markdown',
        'Raw markdown is the source of truth.',
        '```',
      ].join('\n'),
    );
    assert.equal(prompt.includes('Comment:'), false);
  });

  it('includes a Comment section when the user typed one', () => {
    const prompt = buildChatPrompt({
      path: 'notes.md',
      startLine: 3,
      endLine: 5,
      text: 'one\ntwo',
      comment: '  explain this  ',
    });
    assert.equal(
      prompt,
      [
        'Comment: explain this',
        '',
        'File: notes.md:3-5',
        '',
        '```markdown',
        'one\ntwo',
        '```',
      ].join('\n'),
    );
  });
});

describe('planSendToChat', () => {
  it('uses document lines and ignores comment unless mode is comment', () => {
    const planned = planSendToChat({
      mode: 'selection',
      text: 'beta',
      from: 6,
      to: 10,
      comment: 'should be omitted',
      path: 'doc.md',
      documentText: 'alpha\nbeta\ngamma\n',
    });
    assert.deepEqual({ startLine: planned.startLine, endLine: planned.endLine }, { startLine: 2, endLine: 2 });
    assert.equal(planned.prompt.includes('Comment:'), false);
    assert.match(planned.prompt, /File: doc\.md:2-2/);
  });
});

describe('openCursorChat', () => {
  it('uses workbench.action.chat.open when the command exists', async () => {
    const calls: Array<{ command: string; args: unknown[] }> = [];
    const result = await openCursorChat('hello', {
      getCommands: async () => [CHAT_OPEN_COMMAND, CHAT_FALLBACK_NEW_COMMAND],
      executeCommand: async (command, ...args) => {
        calls.push({ command, args });
      },
      writeClipboard: async () => {
        throw new Error('clipboard should not run when chat.open exists');
      },
    });
    assert.equal(result, 'opened');
    assert.deepEqual(calls, [{ command: CHAT_OPEN_COMMAND, args: ['hello'] }]);
  });

  it('falls back to clipboard + composer.newAgentChat + paste', async () => {
    const clipboard: string[] = [];
    const calls: string[] = [];
    const result = await openCursorChat('prompt-body', {
      getCommands: async () => [CHAT_FALLBACK_NEW_COMMAND, CHAT_FALLBACK_PASTE_COMMAND],
      executeCommand: async (command) => {
        calls.push(command);
      },
      writeClipboard: async (text) => {
        clipboard.push(text);
      },
    });
    assert.equal(result, 'clipboard-fallback');
    assert.deepEqual(clipboard, ['prompt-body']);
    assert.deepEqual(calls, [CHAT_FALLBACK_NEW_COMMAND, CHAT_FALLBACK_PASTE_COMMAND]);
  });
});
