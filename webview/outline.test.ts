import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  defaultOutlineOpen,
  nestOutline,
  outlineAutoCollapsed,
  outlineDebounceMs,
  outlinePanelShouldRender,
  outlineTreeFromMarkdown,
  parseAtxHeadingLine,
  parseOutlineHeadings,
} from './outline.ts';

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

  it('accepts ATX headings indented with 1–3 spaces and rejects 4-space indent', () => {
    const md = [' # One', '  ## Two', '   ### Three', '    # code'].join('\n');
    assert.deepEqual(
      parseOutlineHeadings(md).map((h) => `${h.level}:${h.text}`),
      ['1:One', '2:Two', '3:Three'],
    );
    assert.equal(parseAtxHeadingLine('    # code'), undefined);
  });

  it('keeps a terminal # that is not a whitespace-preceded closing sequence', () => {
    assert.equal(parseAtxHeadingLine('# Foo#')?.text, 'Foo#');
    assert.equal(parseAtxHeadingLine('# Foo ##')?.text, 'Foo');
    assert.equal(parseAtxHeadingLine('# C#')?.text, 'C#');
    assert.equal(parseAtxHeadingLine('#Foo'), undefined);
    assert.equal(parseAtxHeadingLine('#')?.text, '');
  });

  it('collapses the outline panel on a narrow editor width', () => {
    assert.equal(outlineAutoCollapsed(900), false);
    assert.equal(outlineAutoCollapsed(641), false);
    assert.equal(outlineAutoCollapsed(640), true);
    assert.equal(outlineAutoCollapsed(300), true);
    assert.equal(outlinePanelShouldRender({ enabled: true, open: true, editorWidthPx: 800 }), true);
    assert.equal(outlinePanelShouldRender({ enabled: true, open: true, editorWidthPx: 500 }), false);
    assert.equal(outlinePanelShouldRender({ enabled: true, open: false, editorWidthPx: 800 }), false);
  });
});

describe('outline panel CSS', () => {
  const css = readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'theme.css'), 'utf8');

  it('does not pin a crushing 11rem minimum and hides the rail when narrow', () => {
    assert.equal(/min-width:\s*11rem/.test(css), false);
    assert.match(css, /min-width:\s*0/);
    assert.match(css, /@container atomic-editor \(max-width: 640px\)/);
    assert.match(css, /@media \(max-width: 640px\)/);
  });
});
