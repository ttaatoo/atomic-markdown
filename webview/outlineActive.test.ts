import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { parseOutlineHeadings } from './outline.ts';
import {
  activeOutlineHeadingFrom,
  docPosAtScrollTop,
  headingAtScrollPosition,
  outlineNavOffset,
  visibleTopDocPos,
} from './outlineActive.ts';

const WELCOME_SHAPED = [
  '# Welcome to Atomic Markdown',
  '',
  'intro',
  '',
  '## Tables',
  '',
  'table body',
  '',
  '## Fences',
  '',
  '```ts',
  'const x = 1;',
  '```',
].join('\n');

describe('heading at scroll position', () => {
  const headings = parseOutlineHeadings(WELCOME_SHAPED);
  const tables = headings.find((h) => h.text === 'Tables');
  const fences = headings.find((h) => h.text === 'Fences');

  it('selects Fences when the visible top is in that section even if the caret stayed on Tables', () => {
    assert.ok(tables && fences);
    const pos = outlineNavOffset({
      viewportFrom: fences.from,
      caret: tables.from,
    });
    assert.equal(pos, fences.from);
    assert.equal(headingAtScrollPosition(headings, pos), fences.from);
    assert.notEqual(headingAtScrollPosition(headings, pos), tables.from);
  });

  it('maps a scroller offset onto the line block at that y, then the heading there', () => {
    assert.ok(tables && fences);
    const blocks = [
      { from: headings[0].from, top: 0 },
      { from: tables.from, top: 200 },
      { from: fences.from, top: 800 },
    ];
    const atTables = docPosAtScrollTop(240, blocks);
    const atFences = docPosAtScrollTop(820, blocks);
    assert.equal(headingAtScrollPosition(headings, atTables), tables.from);
    assert.equal(headingAtScrollPosition(headings, atFences), fences.from);
  });
});

describe('activeOutlineHeadingFrom', () => {
  const md = '# One\n\npara\n\n## Two\n\nmore\n\n### Three\n';
  const headings = parseOutlineHeadings(md);

  it('highlights the heading at or before the viewport top', () => {
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

describe('visibleTopDocPos', () => {
  it('asks posAtCoords with precise=false so a centered column still hits text', () => {
    let precise: boolean | undefined;
    const pos = visibleTopDocPos({
      scrollDOM: {
        scrollTop: 400,
        getBoundingClientRect: () => ({ left: 0, top: 0, right: 800, height: 500 }),
      },
      contentDOM: {
        getBoundingClientRect: () => ({ left: 220, top: -400, right: 580 }),
      },
      posAtCoords: (_coords, isPrecise) => {
        precise = isPrecise;
        return 96;
      },
      lineBlockAtHeight: () => ({ from: 0 }),
      viewport: { from: 0 },
    });
    assert.equal(precise, false);
    assert.equal(pos, 96);
  });
});
