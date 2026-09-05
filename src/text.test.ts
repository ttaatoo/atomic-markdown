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

  it('round-trips a generated ~1.5MB document through LF and CRLF without changing characters', () => {
    const lf = `${'# Heading\n\n'}${'paragraph text with some words.\n'.repeat(50_000)}`;
    assert.ok(lf.length >= 1_000_000, `fixture too small: ${lf.length}`);
    assert.ok(lf.length <= 5_000_000, `fixture too large: ${lf.length}`);
    const crlf = toDocumentEol(lf, '\r\n');
    assert.equal(crlf.includes('\r\n'), true);
    assert.equal(toLineFeed(crlf), lf);
    assert.equal(toDocumentEol(crlf, '\n'), lf);
    assert.equal(sameMarkdown(lf, crlf), true);
  });
});
