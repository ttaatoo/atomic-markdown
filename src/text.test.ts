import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { sameMarkdown, toDocumentEol, toLineFeed } from './text.ts';

describe('text helpers', () => {
  it('normalizes CRLF and CR to LF', () => {
    assert.equal(toLineFeed('a\r\nb\rc\n'), 'a\nb\nc\n');
  });

  it('restores document CRLF without changing content', () => {
    assert.equal(toDocumentEol('a\nb\n', '\r\n'), 'a\r\nb\r\n');
    assert.equal(toDocumentEol('a\r\nb\r\n', '\n'), 'a\nb\n');
  });

  it('compares markdown ignoring line-ending style', () => {
    assert.equal(sameMarkdown('hello\r\nworld', 'hello\nworld'), true);
    assert.equal(sameMarkdown('hello\nworld', 'hello\nworld!'), false);
  });
});
