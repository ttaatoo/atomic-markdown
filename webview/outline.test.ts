import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  defaultOutlineOpen,
  nestOutline,
  outlineDebounceMs,
  outlinePanelShouldRender,
  outlinePlacement,
  outlineTreeFromMarkdown,
  outlineUsesOverlay,
  parseAtxHeadingLine,
  parseOutlineHeadings,
  pruneCollapsedFroms,
  shouldWindowCloseOutlineOverlay,
  toggleCollapsedFrom,
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

  it('parses setext H1 and short-dash H2, not thematic-break ---', () => {
    const md = ['Hello', '=====', '', 'World', '--'].join('\n');
    const headings = parseOutlineHeadings(md);
    assert.deepEqual(
      headings.map((h) => `${h.level}:${h.text}`),
      ['1:Hello', '2:World'],
    );
    assert.deepEqual(
      parseOutlineHeadings(['After a paragraph', '---', '', '# Real'].join('\n')).map((h) => `${h.level}:${h.text}`),
      ['1:Real'],
    );
  });

  it('skips YAML frontmatter so welcome.md-style keys are not setext headings', () => {
    const welcome = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '../samples/welcome.md'), 'utf8');
    const headings = parseOutlineHeadings(welcome);
    assert.equal(
      headings.some((h) => /demo|true|title:/i.test(h.text)),
      false,
    );
    assert.equal(headings[0]?.text, 'Welcome to Atomic Markdown');
    const invented = parseOutlineHeadings(['---', 'title: Welcome', 'demo: true', '---', '', '# Body'].join('\n'));
    assert.deepEqual(
      invented.map((h) => `${h.level}:${h.text}`),
      ['1:Body'],
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

  it('uses a Feishu push rail by default and overlays only at extreme width', () => {
    assert.equal(outlineUsesOverlay(350), false);
    assert.equal(outlineUsesOverlay(500), false);
    assert.equal(outlineUsesOverlay(240), true);
    assert.equal(outlineUsesOverlay(200), true);
    assert.equal(outlineUsesOverlay(241), false);
    assert.equal(outlineUsesOverlay(800), false);
    assert.equal(outlinePanelShouldRender({ enabled: true }), true);
    assert.equal(outlinePanelShouldRender({ enabled: false }), false);
    assert.deepEqual(outlinePlacement({ enabled: true, open: true, editorWidthPx: 350 }), {
      show: true,
      expanded: true,
      mount: 'rail',
    });
    assert.deepEqual(outlinePlacement({ enabled: true, open: true, editorWidthPx: 500 }), {
      show: true,
      expanded: true,
      mount: 'rail',
    });
    assert.deepEqual(outlinePlacement({ enabled: true, open: true, editorWidthPx: 900 }), {
      show: true,
      expanded: true,
      mount: 'rail',
    });
    assert.deepEqual(outlinePlacement({ enabled: true, open: true, editorWidthPx: 240 }), {
      show: true,
      expanded: true,
      mount: 'overlay',
    });
    assert.deepEqual(outlinePlacement({ enabled: true, open: false, editorWidthPx: 900 }), {
      show: true,
      expanded: false,
      mount: 'icon',
    });
    assert.deepEqual(outlinePlacement({ enabled: false, open: true, editorWidthPx: 900 }), {
      show: false,
      expanded: false,
      mount: 'icon',
    });
    assert.equal(shouldWindowCloseOutlineOverlay({ findOpen: true, overlayOpen: true }), false);
    assert.equal(shouldWindowCloseOutlineOverlay({ findOpen: false, overlayOpen: true }), true);
    assert.equal(shouldWindowCloseOutlineOverlay({ findOpen: false, overlayOpen: false }), false);
  });

  it('toggles nested heading collapse and prunes stale froms', () => {
    const tree = outlineTreeFromMarkdown('# Parent\n## Child\n### Deep\n# Other\n');
    const parentFrom = tree[0].from;
    const childFrom = tree[0].children[0].from;
    let collapsed = new Set<number>();
    collapsed = toggleCollapsedFrom(collapsed, parentFrom);
    assert.equal(collapsed.has(parentFrom), true);
    collapsed = toggleCollapsedFrom(collapsed, parentFrom);
    assert.equal(collapsed.has(parentFrom), false);
    collapsed = toggleCollapsedFrom(collapsed, parentFrom);
    collapsed = toggleCollapsedFrom(collapsed, childFrom);
    collapsed.add(9999);
    const pruned = pruneCollapsedFroms(collapsed, tree);
    assert.equal(pruned.has(parentFrom), true);
    assert.equal(pruned.has(childFrom), true);
    assert.equal(pruned.has(9999), false);
    const afterDrop = pruneCollapsedFroms(pruned, outlineTreeFromMarkdown('# Other\n'));
    assert.equal(afterDrop.size, 0);
  });
});

describe('outline panel CSS', () => {
  const css = readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'theme.css'), 'utf8');

  it('does not pin a crushing 11rem minimum and uses a drawer instead of display:none', () => {
    assert.equal(/min-width:\s*11rem/.test(css), false);
    assert.match(css, /min-width:\s*0/);
    assert.equal(/display:\s*none/.test(css), false);
  });

  it('pushes a real sidebar rail and keeps overlay as last resort only', () => {
    assert.match(css, /\.editor-frame\s*\{/);
    assert.match(css, /\.outline-panel \{[\s\S]*flex:\s*0 0 15\.5rem/);
    assert.match(css, /\.outline-panel\.outline-panel-collapsed \{[\s\S]*flex:\s*0 0 2rem/);
    assert.match(css, /\.outline-twisty/);
    assert.match(css, /\.outline-icon-btn/);
    assert.equal(/@container atomic-editor \(max-width: 640px\)/.test(css), false);
    assert.match(css, /@container atomic-editor \(max-width: 720px\)/);
    assert.match(css, /\.outline-panel\.outline-panel-overlay/);
    const overlayAt = css.indexOf('.outline-panel.outline-panel-overlay');
    const overlayBlock = css.slice(overlayAt, css.indexOf('}', overlayAt) + 1);
    assert.match(overlayBlock, /position:\s*absolute/);
    assert.match(overlayBlock, /flex:\s*none/);
    assert.equal(/flex:\s*0 1 15\.5rem/.test(overlayBlock), false);
  });

  it('styles the empty state and the live current-heading mark', () => {
    assert.match(css, /\.outline-empty\s*\{/);
    assert.match(css, /\.outline-item-active\s*\{/);
    assert.match(css, /\.outline-twisty/);
    assert.match(css, /\.outline-icon-btn/);
  });
});
