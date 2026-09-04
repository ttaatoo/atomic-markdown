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
  FOREIGN_CHROME_FOCUS_SELECTOR,
  activeInsideWritingSurface,
  editorInteractionActive,
  isForeignChromeFocus,
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

function fakeActive(opts: { nodeName: string; id?: string; matches?: string[] }) {
  const tokens = opts.matches ?? [];
  return {
    nodeName: opts.nodeName,
    id: opts.id ?? '',
    closest(selector: string) {
      const parts = selector.split(',').map((part) => part.trim());
      return parts.some((part) => tokens.includes(part)) ? this : null;
    },
  };
}

function flagsForActive(active: Parameters<typeof isForeignChromeFocus>[0]): SelectionBarFlags {
  return {
    readOnly: false,
    selectionEmpty: false,
    focusOnForeignChrome: isForeignChromeFocus(active),
  };
}

describe('shouldShowSelectionBar', () => {
  it('shows a non-empty edit selection when activeElement is DIV#root or .app', () => {
    const root = fakeActive({ nodeName: 'DIV', id: 'root', matches: ['#root'] });
    const app = fakeActive({ nodeName: 'DIV', matches: ['.app'] });
    const frame = fakeActive({ nodeName: 'DIV', matches: ['.editor-frame'] });
    assert.equal(isForeignChromeFocus(root), false);
    assert.equal(isForeignChromeFocus(app), false);
    assert.equal(isForeignChromeFocus(frame), false);
    assert.equal(shouldShowSelectionBar(flagsForActive(root)), true);
    assert.equal(shouldShowSelectionBar(flagsForActive(app)), true);
    assert.equal(shouldShowSelectionBar(flagsForActive(frame)), true);
    assert.ok(activeInsideWritingSurface(root));
    assert.ok(activeInsideWritingSurface(app));
  });

  it('shows a non-empty edit selection when hasFocus is false and activeElement is BODY', () => {
    const body = fakeActive({ nodeName: 'BODY' });
    assert.equal(isForeignChromeFocus(body), false);
    assert.equal(shouldShowSelectionBar(flagsForActive(body)), true);
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
  });

  it('hides when focus is on an outline button or notice dismiss', () => {
    const outlineBtn = fakeActive({
      nodeName: 'BUTTON',
      matches: ['.outline-icon-btn', '.outline-panel button'],
    });
    const outlineItem = fakeActive({ nodeName: 'BUTTON', matches: ['.outline-item'] });
    const dismiss = fakeActive({ nodeName: 'BUTTON', matches: ['.atomic-notice-dismiss'] });
    assert.equal(isForeignChromeFocus(outlineBtn), true);
    assert.equal(isForeignChromeFocus(outlineItem), true);
    assert.equal(isForeignChromeFocus(dismiss), true);
    assert.equal(shouldShowSelectionBar(flagsForActive(outlineBtn)), false);
    assert.equal(shouldShowSelectionBar(flagsForActive(outlineItem)), false);
    assert.equal(shouldShowSelectionBar(flagsForActive(dismiss)), false);
  });

  it('hides in reading mode or when the selection is empty', () => {
    assert.equal(
      shouldShowSelectionBar({ readOnly: true, selectionEmpty: false, focusOnForeignChrome: false }),
      false,
    );
    assert.equal(
      shouldShowSelectionBar({ readOnly: false, selectionEmpty: true, focusOnForeignChrome: false }),
      false,
    );
  });

  it('defaults to show for !readOnly && !sel.empty without inverting editorOrBar', () => {
    assert.equal(shouldShowSelectionBar(showFlags), true);
    assert.match(FOREIGN_CHROME_FOCUS_SELECTOR, /\.outline-icon-btn/);
    assert.match(FOREIGN_CHROME_FOCUS_SELECTOR, /\.atomic-notice-dismiss/);
  });

  it('still mounts a box when activeElement is #root and every coord source is null', () => {
    const root = fakeActive({ nodeName: 'DIV', id: 'root', matches: ['#root'] });
    const box = selectionBarFromSources({
      flags: flagsForActive(root),
      start: null,
      end: null,
      fallbacks: [null, null, null],
      viewport,
      bar: barSize,
    });
    assert.ok(box);
    assert.deepEqual(box, placeSelectionBar(SAFE_DEFAULT_ANCHOR, viewport, barSize));
  });
});

describe('editorInteractionActive', () => {
  it('treats shell DIV and BODY as flicker, not a leave', () => {
    assert.equal(
      editorInteractionActive({
        hasFocus: false,
        pointerOnBar: false,
        activeInsideEditor: false,
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
        activeInsideEditor: false,
        activeInsideBar: false,
        activeNodeName: 'BUTTON',
        focusOnForeignChrome: true,
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
    assert.equal(app.includes('SelectionFormatBar'), false);
    assert.match(app, /EXTRA_EXTENSIONS/);
    assert.equal(css.includes('.atomic-chrome'), false);
    assert.equal(css.includes('.atomic-reading-chip'), false);
    assert.match(css, /\.selection-format-bar/);
    assert.match(css, /z-index:\s*50/);
    assert.equal(pkg.includes('atomicMarkdown.toolbar.enabled'), false);
    assert.equal(/\*\s*\{[^}]*transition/.test(css), false);
  });
});
