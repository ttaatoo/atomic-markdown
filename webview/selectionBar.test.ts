import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  SAFE_DEFAULT_ANCHOR,
  anchorFromDomPositions,
  contentDefaultAnchor,
  domSelectionAnchor,
  editorInteractionActive,
  isSelectionRefreshKey,
  placeSelectionBar,
  readCoordsAtPos,
  resolveSelectionAnchors,
  SELECTION_FORMAT_ACTIONS,
  selectionBarFromCoords,
  selectionBarFromSources,
  selectionLayerAnchor,
  shouldShowSelectionBar,
  type SelectionAnchor,
  type SelectionBarFlags,
} from './selectionBar.ts';

const showFlags: SelectionBarFlags = {
  readOnly: false,
  selectionEmpty: false,
  focusOnForeignChrome: false,
};

const viewport = { width: 800, height: 600 };
const barSize = { width: 176, height: 32 };

function layerRoot(rects: SelectionAnchor[]) {
  const nodes = rects.map((r) => ({
    getClientRects: () => [r],
    getBoundingClientRect: () => r,
  }));
  return {
    querySelectorAll(selector: string) {
      assert.match(selector, /cm-selectionBackground/);
      return nodes;
    },
  };
}

function collapsedDomSelection() {
  return {
    rangeCount: 1,
    isCollapsed: true,
    getRangeAt() {
      throw new Error('collapsed window.getSelection must not be used as an anchor');
    },
  };
}

describe('shouldShowSelectionBar', () => {
  it('shows a non-empty edit selection even when hasFocus is false and activeElement is BODY', () => {
    const flicker = editorInteractionActive({
      hasFocus: false,
      pointerOnBar: false,
      activeInsideEditor: false,
      activeInsideBar: false,
      activeNodeName: 'BODY',
    });
    assert.equal(flicker, true);
    assert.equal(
      shouldShowSelectionBar({
        readOnly: false,
        selectionEmpty: false,
        focusOnForeignChrome: !flicker,
      }),
      true,
    );
  });

  it('hides in reading mode, when the selection is empty, or when focus is on foreign chrome', () => {
    assert.equal(
      shouldShowSelectionBar({ readOnly: true, selectionEmpty: false, focusOnForeignChrome: false }),
      false,
    );
    assert.equal(
      shouldShowSelectionBar({ readOnly: false, selectionEmpty: true, focusOnForeignChrome: false }),
      false,
    );
    assert.equal(
      shouldShowSelectionBar({ readOnly: false, selectionEmpty: false, focusOnForeignChrome: true }),
      false,
    );
  });
});

describe('editorInteractionActive', () => {
  it('treats body/html/null as flicker and outline buttons as a real leave', () => {
    assert.equal(
      editorInteractionActive({
        hasFocus: false,
        pointerOnBar: false,
        activeInsideEditor: false,
        activeInsideBar: false,
        activeNodeName: 'BODY',
      }),
      true,
    );
    assert.equal(
      editorInteractionActive({
        hasFocus: false,
        pointerOnBar: false,
        activeInsideEditor: false,
        activeInsideBar: false,
        activeNodeName: null,
      }),
      true,
    );
    assert.equal(
      editorInteractionActive({
        hasFocus: false,
        pointerOnBar: false,
        activeInsideEditor: true,
        activeInsideBar: false,
        activeNodeName: 'DIV',
      }),
      true,
    );
    assert.equal(
      editorInteractionActive({
        hasFocus: false,
        pointerOnBar: false,
        activeInsideEditor: false,
        activeInsideBar: false,
        activeNodeName: 'BUTTON',
      }),
      false,
    );
  });
});

describe('readCoordsAtPos', () => {
  it('tries the preferred side, then the opposite, then the unbiased call', () => {
    const calls: Array<number | undefined> = [];
    const coords = readCoordsAtPos((pos, side) => {
      calls.push(side);
      if (side === 1) {
        return null;
      }
      if (side === -1) {
        return { top: 10, bottom: 20, left: 4, right: 40 };
      }
      return null;
    }, 3, 1);
    assert.deepEqual(calls, [1, -1]);
    assert.deepEqual(coords, { top: 10, bottom: 20, left: 4, right: 40 });
  });

  it('swallows coordsAtPos throws so they never escape', () => {
    assert.equal(
      readCoordsAtPos(() => {
        throw new Error('coordsAtPos boom');
      }, 10, 1),
      null,
    );
    assert.equal(
      readCoordsAtPos((_pos, side) => {
        if (side === 1) {
          throw new Error('preferred side');
        }
        return null;
      }, 10, 1),
      null,
    );
  });
});

describe('drawSelection / collapsed DOM placement', () => {
  it('places from .cm-selectionBackground when CM coords and window.getSelection are unusable', () => {
    const painted = { top: 120, bottom: 140, left: 80, right: 200 };
    const layer = selectionLayerAnchor(layerRoot([painted]));
    assert.deepEqual(layer, painted);

    const windowSel = domSelectionAnchor(collapsedDomSelection(), { contains: () => true });
    assert.equal(windowSel, null);

    const box = selectionBarFromSources({
      flags: showFlags,
      start: null,
      end: null,
      fallbacks: [layer, null, windowSel, null],
      viewport,
      bar: barSize,
    });
    assert.ok(box);
    assert.deepEqual(box, placeSelectionBar(painted, viewport, barSize));
  });

  it('unions selection-layer children and ignores collapsed DOM ranges', () => {
    const layer = selectionLayerAnchor(
      layerRoot([
        { top: 100, bottom: 118, left: 40, right: 90 },
        { top: 118, bottom: 136, left: 20, right: 160 },
      ]),
    );
    assert.deepEqual(layer, { top: 100, bottom: 136, left: 20, right: 160 });
  });

  it('builds an anchor from domAtPos Range rects', () => {
    const start = { node: {} as Node, offset: 0 };
    const end = { node: {} as Node, offset: 4 };
    const box = anchorFromDomPositions(start, end, () => ({
      setStart() {},
      setEnd() {},
      getBoundingClientRect: () => ({ top: 40, bottom: 56, left: 80, right: 160 }) as DOMRect,
      getClientRects: () => [],
    }));
    assert.deepEqual(box, { top: 40, bottom: 56, left: 80, right: 160 });
  });

  it('still mounts a safe default when every coord source is null', () => {
    const box = selectionBarFromSources({
      flags: showFlags,
      start: null,
      end: null,
      fallbacks: [null, null, null],
      viewport,
      bar: barSize,
    });
    assert.ok(box);
    assert.deepEqual(box, placeSelectionBar(SAFE_DEFAULT_ANCHOR, viewport, barSize));
  });

  it('uses a contentDOM top-center band before the hard-coded default', () => {
    const content = contentDefaultAnchor({ top: 80, bottom: 400, left: 100, right: 500 });
    assert.ok(content);
    const box = selectionBarFromSources({
      flags: showFlags,
      start: null,
      end: null,
      fallbacks: [null, null, content],
      viewport,
      bar: barSize,
    });
    assert.deepEqual(box, placeSelectionBar(content, viewport, barSize));
  });

  it('resolves mixed CM + fallback anchors', () => {
    const start = { top: 10, bottom: 20, left: 10, right: 20 };
    const painted = { top: 10, bottom: 24, left: 10, right: 80 };
    assert.deepEqual(resolveSelectionAnchors({ start, end: null, fallbacks: [painted] }), {
      start,
      end: painted,
    });
    assert.equal(resolveSelectionAnchors({ start: null, end: null, fallbacks: [null] }), null);
  });
});

describe('placeSelectionBar', () => {
  it('sits above the selection and clamps to the viewport', () => {
    const above = placeSelectionBar(
      { top: 120, bottom: 140, left: 80, right: 200 },
      viewport,
      barSize,
    );
    assert.equal(above.top, 80);
    assert.equal(above.left, 52);

    const nearTop = placeSelectionBar(
      { top: 10, bottom: 28, left: 20, right: 80 },
      { width: 400, height: 300 },
      barSize,
    );
    assert.equal(nearTop.top, 36);
    assert.ok(nearTop.left >= 8);
    assert.ok(nearTop.left + 176 <= 400 - 8);
  });

  it('returns null when the selection should not show a bar even if fallbacks exist', () => {
    assert.equal(
      selectionBarFromCoords(
        { readOnly: false, selectionEmpty: true, focusOnForeignChrome: false },
        null,
        null,
        viewport,
        barSize,
        { top: 10, bottom: 20, left: 10, right: 40 },
      ),
      null,
    );
  });
});

describe('selection format actions', () => {
  it('exposes only inline formats on the floating bar', () => {
    assert.deepEqual(SELECTION_FORMAT_ACTIONS, ['bold', 'italic', 'strike', 'inlineCode', 'link']);
  });

  it('refreshes on shift/arrow selection keys', () => {
    assert.equal(isSelectionRefreshKey('ArrowRight', true), true);
    assert.equal(isSelectionRefreshKey('Shift', false), true);
    assert.equal(isSelectionRefreshKey('a', false), false);
  });
});

describe('no top chrome', () => {
  const root = join(dirname(fileURLToPath(import.meta.url)), '..');
  const app = readFileSync(join(root, 'webview/App.tsx'), 'utf8');
  const css = readFileSync(join(root, 'webview/theme.css'), 'utf8');
  const pkg = readFileSync(join(root, 'package.json'), 'utf8');

  it('does not render a top Format strip, reading chip, or toolbar', () => {
    assert.equal(app.includes('atomic-chrome'), false);
    assert.equal(app.includes('atomic-reading-chip'), false);
    assert.equal(app.includes('formatStripOpen'), false);
    assert.equal(app.includes('<Toolbar'), false);
    assert.match(app, /SelectionFormatBar/);
    assert.match(app, /selectionchange/);
    assert.match(app, /mouseup/);
    assert.match(app, /selectionLayerAnchor/);
    assert.match(app, /anchorFromDomPositions/);
    assert.match(app, /contentDefaultAnchor/);
    assert.match(app, /selectionBarFromSources/);
    assert.match(app, /focusOnForeignChrome/);
    assert.equal(css.includes('.atomic-chrome'), false);
    assert.equal(css.includes('.atomic-reading-chip'), false);
    assert.match(css, /\.selection-format-bar/);
    assert.match(css, /z-index:\s*50/);
    assert.equal(pkg.includes('atomicMarkdown.toolbar.enabled'), false);
    assert.equal(/\*\s*\{[^}]*transition/.test(css), false);
  });
});
