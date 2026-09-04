import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { parseOutlineHeadings } from './outline.ts';
import { activeOutlineHeadingFrom, caretInViewport, outlineNavOffset } from './outlineActive.ts';

describe('activeOutlineHeadingFrom', () => {
  const md = '# One\n\npara\n\n## Two\n\nmore\n\n### Three\n';
  const headings = parseOutlineHeadings(md);

  it('highlights the heading at or before the viewport/caret', () => {
    assert.equal(headings.length, 3);
    assert.equal(activeOutlineHeadingFrom(headings, 0), headings[0]?.from);
    assert.equal(activeOutlineHeadingFrom(headings, headings[1].from), headings[1]?.from);
    assert.equal(activeOutlineHeadingFrom(headings, headings[1].from + 8), headings[1]?.from);
    assert.equal(activeOutlineHeadingFrom(headings, headings[2].from + 1), headings[2]?.from);
  });

  it('returns undefined when there are no headings yet', () => {
    assert.equal(activeOutlineHeadingFrom([], 10), undefined);
  });
});

describe('outlineNavOffset', () => {
  it('uses the caret when it is in view, otherwise the viewport top', () => {
    assert.equal(outlineNavOffset({ viewportFrom: 40, caret: 80, caretInView: true }), 80);
    assert.equal(outlineNavOffset({ viewportFrom: 40, caret: 800, caretInView: false }), 40);
    assert.equal(caretInViewport(80, 0, 100), true);
    assert.equal(caretInViewport(180, 0, 100), false);
  });
});
