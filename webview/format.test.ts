import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { applyFormatToString, insertSnippet } from './format.ts';

describe('applyFormatToString', () => {
  it('wraps and unwraps bold, italic, and inline code around a selection', () => {
    assert.deepEqual(applyFormatToString('say hi', 4, 6, 'bold'), {
      text: 'say **hi**',
      from: 6,
      to: 8,
    });
    assert.deepEqual(applyFormatToString('say **hi**', 4, 10, 'bold'), {
      text: 'say hi',
      from: 4,
      to: 6,
    });
    assert.equal(applyFormatToString('x', 0, 1, 'italic').text, '*x*');
    assert.equal(applyFormatToString('x', 0, 1, 'strike').text, '~~x~~');
    assert.equal(applyFormatToString('~~x~~', 0, 5, 'strike').text, 'x');
    assert.equal(applyFormatToString('x', 0, 1, 'inlineCode').text, '`x`');
  });

  it('turns a selection into a markdown link with the url selected', () => {
    const result = applyFormatToString('see docs', 4, 8, 'link');
    assert.equal(result.text, 'see [docs](url)');
    assert.equal(result.text.slice(result.from, result.to), 'url');
  });

  it('cycles ATX headings on the current line', () => {
    assert.equal(applyFormatToString('Title', 0, 0, 'heading').text, '# Title');
    assert.equal(applyFormatToString('# Title', 0, 0, 'heading').text, '## Title');
    assert.equal(applyFormatToString('## Title', 0, 0, 'heading').text, '### Title');
    assert.equal(applyFormatToString('### Title', 0, 0, 'heading').text, 'Title');
  });

  it('toggles bullet, numbered, and task prefixes on selected lines', () => {
    const block = 'one\ntwo';
    assert.equal(applyFormatToString(block, 0, block.length, 'bulletList').text, '- one\n- two');
    assert.equal(
      applyFormatToString('- one\n- two', 0, 11, 'bulletList').text,
      'one\ntwo',
    );
    assert.equal(applyFormatToString('one\ntwo', 0, 7, 'numberedList').text, '1. one\n2. two');
    assert.equal(applyFormatToString('one', 0, 3, 'taskList').text, '- [ ] one');
  });

  it('places a link around a selected URL with the label selected', () => {
    const result = applyFormatToString('see https://example.com', 4, 23, 'link');
    assert.equal(result.text, 'see [text](https://example.com)');
    assert.equal(result.text.slice(result.from, result.to), 'text');
  });

  it('inserts a snippet at the caret', () => {
    const patch = insertSnippet('ab', 1, 1, '![x](./a.png)');
    assert.equal(patch.insert, '![x](./a.png)');
    assert.equal(patch.selectionFrom, 1 + '![x](./a.png)'.length);
    const next = 'ab'.slice(0, patch.replaceFrom) + patch.insert + 'ab'.slice(patch.replaceTo);
    assert.equal(next, 'a![x](./a.png)b');
  });

  it('preserves leading indentation when cycling a heading', () => {
    const result = applyFormatToString('  Title', 2, 2, 'heading');
    assert.equal(result.text, '  # Title');
    assert.equal(result.from, 4);
    assert.equal(result.to, 4);
    assert.equal(applyFormatToString('    ### Nested', 0, 0, 'heading').text, '    Nested');
  });

  it('maps heading selection through the marker instead of selecting the whole line', () => {
    const added = applyFormatToString('Title', 1, 4, 'heading');
    assert.equal(added.text, '# Title');
    assert.equal(added.text.slice(added.from, added.to), 'itl');
    const promoted = applyFormatToString('# Title', 2, 7, 'heading');
    assert.equal(promoted.text, '## Title');
    assert.equal(promoted.text.slice(promoted.from, promoted.to), 'Title');
  });

  it('preserves nested list indentation and only changes the marker', () => {
    const md = '- outer\n  inner';
    const innerStart = md.indexOf('inner');
    const listed = applyFormatToString(md, innerStart, innerStart + 5, 'bulletList');
    assert.equal(listed.text, '- outer\n  - inner');
    assert.equal(listed.text.slice(listed.from, listed.to), 'inner');
    const stripped = applyFormatToString('- outer\n  - inner', innerStart + 2, innerStart + 7, 'bulletList');
    assert.equal(stripped.text, '- outer\n  inner');
    assert.equal(stripped.text.slice(stripped.from, stripped.to), 'inner');
  });

  it('maps a collapsed caret through a list marker on an indented line', () => {
    const md = '    item';
    const caret = md.indexOf('t');
    const result = applyFormatToString(md, caret, caret, 'taskList');
    assert.equal(result.text, '    - [ ] item');
    assert.equal(result.from, result.to);
    assert.equal(result.text[result.from], 't');
  });
});
