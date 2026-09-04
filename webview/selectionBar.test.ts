import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  editorInteractionActive,
  isSelectionRefreshKey,
  placeSelectionBar,
  readCoordsAtPos,
  resolveSelectionAnchors,
  SELECTION_FORMAT_ACTIONS,
  selectionBarFromCoords,
  shouldShowSelectionBar,
} from './selectionBar.ts';

describe('shouldShowSelectionBar', () => {
  it('shows when the editor DOM is active even if hasFocus flickered false', () => {
    assert.equal(
      shouldShowSelectionBar({
        readOnly: false,
        selectionEmpty: false,
        editorFocused: false,
        pointerOnBar: false,
        editorDomActive: true,
      }),
      true,
    );
    assert.equal(
      shouldShowSelectionBar({
        readOnly: false,
        selectionEmpty: false,
        editorFocused: true,
        pointerOnBar: false,
        editorDomActive: false,
      }),
      true,
    );
  });

  it('hides in reading mode, when the selection collapses, or when focus left the editor', () => {
    assert.equal(
      shouldShowSelectionBar({
        readOnly: true,
        selectionEmpty: false,
        editorFocused: true,
        pointerOnBar: false,
        editorDomActive: true,
      }),
      false,
    );
    assert.equal(
      shouldShowSelectionBar({
        readOnly: false,
        selectionEmpty: true,
        editorFocused: true,
        pointerOnBar: false,
        editorDomActive: true,
      }),
      false,
    );
    assert.equal(
      shouldShowSelectionBar({
        readOnly: false,
        selectionEmpty: false,
        editorFocused: false,
        pointerOnBar: false,
        editorDomActive: false,
      }),
      false,
    );
    assert.equal(
      shouldShowSelectionBar({
        readOnly: false,
        selectionEmpty: false,
        editorFocused: false,
        pointerOnBar: true,
        editorDomActive: false,
      }),
      true,
    );
  });
});

describe('editorInteractionActive', () => {
  it('keeps the bar through body/html focus flicker and real editor/bar focus', () => {
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

describe('readCoordsAtPos and DOM fallback', () => {
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

  it('uses a DOM range when both CM coords are null', () => {
    const fallback = { top: 40, bottom: 56, left: 80, right: 160 };
    const box = selectionBarFromCoords(
      {
        readOnly: false,
        selectionEmpty: false,
        editorFocused: false,
        pointerOnBar: false,
        editorDomActive: true,
      },
      null,
      null,
      { width: 800, height: 600 },
      { width: 176, height: 32 },
      fallback,
    );
    assert.deepEqual(box, placeSelectionBar(fallback, { width: 800, height: 600 }, { width: 176, height: 32 }));
  });

  it('resolves mixed CM + DOM anchors', () => {
    const start = { top: 10, bottom: 20, left: 10, right: 20 };
    const dom = { top: 10, bottom: 24, left: 10, right: 80 };
    assert.deepEqual(resolveSelectionAnchors({ start, end: null, domFallback: dom }), { start, end: dom });
    assert.equal(resolveSelectionAnchors({ start: null, end: null, domFallback: null }), null);
  });
});

describe('placeSelectionBar', () => {
  it('sits above the selection and clamps to the viewport', () => {
    const above = placeSelectionBar(
      { top: 120, bottom: 140, left: 80, right: 200 },
      { width: 800, height: 600 },
      { width: 176, height: 32 },
    );
    assert.equal(above.top, 80);
    assert.equal(above.left, 52);

    const nearTop = placeSelectionBar(
      { top: 10, bottom: 28, left: 20, right: 80 },
      { width: 400, height: 300 },
      { width: 176, height: 32 },
    );
    assert.equal(nearTop.top, 36);
    assert.ok(nearTop.left >= 8);
    assert.ok(nearTop.left + 176 <= 400 - 8);
  });

  it('returns null when the selection should not show a bar', () => {
    assert.equal(
      selectionBarFromCoords(
        {
          readOnly: false,
          selectionEmpty: true,
          editorFocused: true,
          pointerOnBar: false,
          editorDomActive: true,
        },
        { top: 10, bottom: 20, left: 10, right: 40 },
        { top: 10, bottom: 20, left: 40, right: 80 },
        { width: 400, height: 300 },
        { width: 176, height: 32 },
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
    assert.equal(css.includes('.atomic-chrome'), false);
    assert.equal(css.includes('.atomic-reading-chip'), false);
    assert.match(css, /\.selection-format-bar/);
    assert.match(css, /z-index:\s*50/);
    assert.equal(pkg.includes('atomicMarkdown.toolbar.enabled'), false);
    assert.equal(/\*\s*\{[^}]*transition/.test(css), false);
  });
});
