import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  placeSelectionBar,
  SELECTION_FORMAT_ACTIONS,
  selectionBarFromCoords,
  shouldShowSelectionBar,
} from './selectionBar.ts';

describe('shouldShowSelectionBar', () => {
  it('hides in reading mode, when the selection collapses, or when focus leaves', () => {
    assert.equal(
      shouldShowSelectionBar({ readOnly: false, selectionEmpty: false, editorFocused: true, pointerOnBar: false }),
      true,
    );
    assert.equal(
      shouldShowSelectionBar({ readOnly: true, selectionEmpty: false, editorFocused: true, pointerOnBar: false }),
      false,
    );
    assert.equal(
      shouldShowSelectionBar({ readOnly: false, selectionEmpty: true, editorFocused: true, pointerOnBar: false }),
      false,
    );
    assert.equal(
      shouldShowSelectionBar({ readOnly: false, selectionEmpty: false, editorFocused: false, pointerOnBar: false }),
      false,
    );
    assert.equal(
      shouldShowSelectionBar({ readOnly: false, selectionEmpty: false, editorFocused: false, pointerOnBar: true }),
      true,
    );
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
        { readOnly: false, selectionEmpty: true, editorFocused: true, pointerOnBar: false },
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
    assert.equal(css.includes('.atomic-chrome'), false);
    assert.equal(css.includes('.atomic-reading-chip'), false);
    assert.match(css, /\.selection-format-bar/);
    assert.equal(pkg.includes('atomicMarkdown.toolbar.enabled'), false);
    assert.equal(/\*\s*\{[^}]*transition/.test(css), false);
  });
});
