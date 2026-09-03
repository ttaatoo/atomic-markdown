import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { defaultOutlineOpen, nestOutline, outlineDebounceMs, outlineTreeFromMarkdown, parseOutlineHeadings } from './outline.ts';

describe('parseOutlineHeadings', () => {
  it('reads ATX headings and ignores # inside fenced code', () => {
    const md = ['# Intro', '', '```js', '# not a heading', '```', '', '## Next'].join('\n');
    const headings = parseOutlineHeadings(md);
    assert.deepEqual(
      headings.map((h) => `${h.level}:${h.text}`),
      ['1:Intro', '2:Next'],
    );
  });

  it('keeps duplicate titles as separate entries and allows skipped levels', () => {
    const md = '# A\n### Deep\n# A\n';
    const headings = parseOutlineHeadings(md);
    assert.equal(headings.length, 3);
    assert.equal(headings[0].text, 'A');
    assert.equal(headings[1].level, 3);
    assert.notEqual(headings[0].from, headings[2].from);
    const tree = nestOutline(headings);
    assert.equal(tree.length, 2);
    assert.equal(tree[0].children[0]?.text, 'Deep');
  });

  it('parses setext H1/H2', () => {
    const md = ['Hello', '=====', '', 'World', '-----'].join('\n');
    const headings = parseOutlineHeadings(md);
    assert.deepEqual(
      headings.map((h) => `${h.level}:${h.text}`),
      ['1:Hello', '2:World'],
    );
  });

  it('returns an empty list when there are no headings', () => {
    assert.deepEqual(parseOutlineHeadings('just a paragraph\n'), []);
  });

  it('rebuilds the nested tree when a heading is inserted', () => {
    const before = outlineTreeFromMarkdown('# A\n');
    const after = outlineTreeFromMarkdown('# A\n## B\n');
    assert.equal(before[0]?.children.length, 0);
    assert.equal(after[0]?.children[0]?.text, 'B');
  });

  it('uses a longer debounce for large documents and stays closed when disabled', () => {
    assert.equal(outlineDebounceMs(100), 80);
    assert.equal(outlineDebounceMs(250_000), 200);
    assert.equal(defaultOutlineOpen(true, true), true);
    assert.equal(defaultOutlineOpen(true, false), false);
    assert.equal(defaultOutlineOpen(false, true), false);
  });
});
