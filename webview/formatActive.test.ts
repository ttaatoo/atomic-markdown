import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { detectFormatActive, formatActiveEqual } from './formatActive.ts';

describe('detectFormatActive', () => {
  it('marks bold/italic/code from wrap or caret-inside', () => {
    const md = 'say **bold** and *em* and `code`';
    assert.equal(md.slice(4, 12), '**bold**');
    assert.equal(md.slice(17, 21), '*em*');
    assert.equal(md.slice(26, 32), '`code`');
    assert.equal(detectFormatActive(md, 4, 12).bold, true);
    assert.equal(detectFormatActive(md, 7, 7).bold, true);
    assert.equal(detectFormatActive(md, 0, 0).bold, false);
    assert.equal(detectFormatActive(md, 17, 21).italic, true);
    assert.equal(detectFormatActive(md, 26, 32).inlineCode, true);
  });

  it('does not treat **bold** as italic', () => {
    const md = '**bold**';
    assert.equal(detectFormatActive(md, 2, 2).bold, true);
    assert.equal(detectFormatActive(md, 2, 2).italic, false);
  });

  it('detects heading and list kinds on the current line', () => {
    assert.equal(detectFormatActive('# Title', 3, 3).heading, true);
    assert.equal(detectFormatActive('## Title', 0, 0).heading, true);
    assert.equal(detectFormatActive('plain', 0, 0).heading, false);
    assert.equal(detectFormatActive('- item', 2, 2).bulletList, true);
    assert.equal(detectFormatActive('1. item', 3, 3).numberedList, true);
    assert.equal(detectFormatActive('- [ ] task', 6, 6).taskList, true);
    assert.equal(detectFormatActive('- [ ] task', 6, 6).bulletList, false);
    assert.equal(detectFormatActive('1. [x] done', 4, 4).taskList, true);
    assert.equal(detectFormatActive('1. [x] done', 4, 4).numberedList, false);
  });

  it('treats equivalent pressed maps as equal', () => {
    assert.equal(formatActiveEqual({ bold: true }, { bold: true, italic: false }), true);
    assert.equal(formatActiveEqual({ bold: true }, { bold: false }), false);
  });

  it('detects a markdown link at the caret', () => {
    const md = 'see [docs](https://example.com) now';
    assert.equal(detectFormatActive(md, 6, 6).link, true);
    assert.equal(detectFormatActive(md, 0, 0).link, false);
  });
});
