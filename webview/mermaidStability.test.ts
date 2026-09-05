import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import { findMermaidFenceRanges } from './mermaidFences.ts';
import {
  mermaidDecorationsShouldRebuild,
  mermaidDomAlreadyRendered,
  mermaidFenceOccupancy,
  mermaidWidgetReuseKey,
  normalizeMermaidSvgElement,
  shouldUpdateMermaidHeightCache,
} from './mermaidStability.ts';

describe('mermaidFenceOccupancy', () => {
  const md = 'hello\n\n```mermaid\ngraph TD\nA-->B\n```\n\n```mermaid\npie\n```\n';
  const fences = findMermaidFenceRanges(md);

  it('is stable while the caret stays outside every fence', () => {
    const a = mermaidFenceOccupancy(fences, [{ from: 0, to: 0 }], false);
    const b = mermaidFenceOccupancy(fences, [{ from: 3, to: 3 }], false);
    assert.equal(a, b);
    assert.equal(a, '00');
  });

  it('changes only when the caret enters or leaves a fence', () => {
    const outside = mermaidFenceOccupancy(fences, [{ from: 0, to: 0 }], false);
    const inside = mermaidFenceOccupancy(fences, [{ from: fences[0].from + 12, to: fences[0].from + 12 }], false);
    assert.equal(outside, '00');
    assert.equal(inside, '10');
    assert.equal(mermaidFenceOccupancy(fences, [{ from: 0, to: 0 }], true), 'ro');
  });
});

describe('mermaidDecorationsShouldRebuild', () => {
  it('ignores caret moves that do not change fence occupancy', () => {
    assert.equal(
      mermaidDecorationsShouldRebuild({
        docChanged: false,
        themeChanged: false,
        readOnlyChanged: false,
        occupancyChanged: false,
      }),
      false,
    );
  });

  it('rebuilds on doc, theme, reading-mode, or occupancy changes', () => {
    assert.equal(
      mermaidDecorationsShouldRebuild({
        docChanged: true,
        themeChanged: false,
        readOnlyChanged: false,
        occupancyChanged: false,
      }),
      true,
    );
    assert.equal(
      mermaidDecorationsShouldRebuild({
        docChanged: false,
        themeChanged: true,
        readOnlyChanged: false,
        occupancyChanged: false,
      }),
      true,
    );
    assert.equal(
      mermaidDecorationsShouldRebuild({
        docChanged: false,
        themeChanged: false,
        readOnlyChanged: true,
        occupancyChanged: false,
      }),
      true,
    );
    assert.equal(
      mermaidDecorationsShouldRebuild({
        docChanged: false,
        themeChanged: false,
        readOnlyChanged: false,
        occupancyChanged: true,
      }),
      true,
    );
  });
});

describe('normalizeMermaidSvgElement', () => {
  it('drops 100% width/height that collapse CM6 block widgets', () => {
    const removed: string[] = [];
    const style = { width: '100%', height: '100%', maxWidth: '', display: '' };
    const svg = {
      getAttribute: (name: string) => (name === 'width' || name === 'height' ? '100%' : null),
      removeAttribute: (name: string) => {
        removed.push(name);
      },
      style,
    };
    normalizeMermaidSvgElement(svg);
    assert.deepEqual(removed.sort(), ['height', 'width']);
    assert.equal(style.height, 'auto');
    assert.equal(style.maxWidth, '100%');
    assert.equal(style.display, 'block');
  });
});

describe('mermaid height cache / DOM reuse', () => {
  it('ignores non-finite or tiny measure noise', () => {
    assert.equal(shouldUpdateMermaidHeightCache(undefined, 180), true);
    assert.equal(shouldUpdateMermaidHeightCache(180, 181), false);
    assert.equal(shouldUpdateMermaidHeightCache(180, 200), true);
    assert.equal(shouldUpdateMermaidHeightCache(180, 0), false);
    assert.equal(shouldUpdateMermaidHeightCache(180, Number.NaN), false);
  });

  it('skips a second render when the widget DOM already matches the key', () => {
    const key = mermaidWidgetReuseKey('graph TD\nA-->B', 'dark', true);
    assert.equal(mermaidDomAlreadyRendered({ mermaidRendered: key }, key), true);
    assert.equal(mermaidDomAlreadyRendered({ mermaidRendered: key }, key + 'x'), false);
  });
});

describe('mermaidBlocks source (gray-blank guards)', () => {
  const dir = dirname(fileURLToPath(import.meta.url));
  const blocks = readFileSync(join(dir, 'mermaidBlocks.ts'), 'utf8');

  it('does not restyle mermaid via a dummy document change', () => {
    assert.equal(/insert:\s*['"]{2}/.test(blocks), false);
    assert.match(blocks, /mermaidThemeEffect/);
    assert.match(blocks, /mermaidDecorationsShouldRebuild/);
  });
});
