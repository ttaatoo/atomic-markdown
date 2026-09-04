import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import { EditorState } from '@codemirror/state';
import { showTooltip } from '@codemirror/view';
import {
  formatTooltipForState,
  selectionFormatTooltip,
  selectionFormatTooltipField,
  shouldShowFormatTooltip,
  tooltipAnchorRect,
} from './selectionFormatTooltip.ts';

const PROSE = 'Raw markdown is the source of truth.';
const FROM = 0;
const TO = PROSE.length;

function stateWithSelection(opts?: { empty?: boolean; readOnly?: boolean }) {
  const empty = opts?.empty ?? false;
  return EditorState.create({
    doc: PROSE,
    selection: empty ? { anchor: FROM } : { anchor: FROM, head: TO },
    extensions: [selectionFormatTooltip(), opts?.readOnly ? EditorState.readOnly.of(true) : []],
  });
}

describe('selectionFormatTooltip field', () => {
  it('produces an above tooltip for a non-empty edit selection', () => {
    const state = stateWithSelection();
    assert.equal(shouldShowFormatTooltip(state), true);
    const tooltip = state.field(selectionFormatTooltipField);
    assert.ok(tooltip);
    assert.equal(tooltip.pos, FROM);
    assert.equal(tooltip.end, TO);
    assert.equal(tooltip.above, true);
    assert.equal(tooltip.clip, false);
    const viaFacet = state.facet(showTooltip).filter(Boolean);
    assert.equal(viaFacet.length, 1);
    assert.equal(viaFacet[0], tooltip);
    const created = formatTooltipForState(state);
    assert.ok(created);
    assert.equal(created.pos, FROM);
  });

  it('hides when the selection is empty or the editor is read-only', () => {
    const empty = stateWithSelection({ empty: true });
    assert.equal(shouldShowFormatTooltip(empty), false);
    assert.equal(empty.field(selectionFormatTooltipField), null);

    const reading = stateWithSelection({ readOnly: true });
    assert.equal(shouldShowFormatTooltip(reading), false);
    assert.equal(reading.field(selectionFormatTooltipField), null);
  });

  it('drops the tooltip after the selection collapses', () => {
    const selected = stateWithSelection();
    const collapsed = selected.update({ selection: { anchor: FROM } }).state;
    assert.equal(collapsed.field(selectionFormatTooltipField), null);
  });
});

describe('tooltipAnchorRect', () => {
  it('falls back to selection-layer rects when coordsAtPos is null', () => {
    const painted = { top: 120, bottom: 140, left: 80, right: 200 };
    const rect = tooltipAnchorRect(
      {
        coordsAtPos: () => null,
        scrollDOM: {
          querySelectorAll: () => [
            {
              getClientRects: () => [painted],
              getBoundingClientRect: () => painted,
            },
          ],
        } as unknown as Element,
      },
      4,
    );
    assert.deepEqual(rect, painted);
  });
});

describe('CM tooltip is wired; React overlay is gone', () => {
  const root = join(dirname(fileURLToPath(import.meta.url)), '..');
  const app = readFileSync(join(root, 'webview/App.tsx'), 'utf8');
  const sync = readFileSync(join(root, 'webview/sync.ts'), 'utf8');
  const css = readFileSync(join(root, 'webview/theme.css'), 'utf8');

  it('composes the tooltip through EXTRA_EXTENSIONS and does not mount a React bar', () => {
    assert.match(sync, /selectionFormatTooltip\(\)/);
    assert.match(sync, /EXTRA_EXTENSIONS/);
    assert.equal(app.includes('SelectionFormatBar'), false);
    assert.equal(app.includes('selectionBarFromSources'), false);
    assert.equal(app.includes('isForeignChromeFocus'), false);
    assert.equal(app.includes('setSelectionBar'), false);
    assert.match(app, /extensions=\{EXTRA_EXTENSIONS\}/);
    assert.match(css, /\.cm-tooltip\.selection-format-bar/);
    assert.match(css, /\.selection-format-bar/);
  });

  it('notifies view-update listeners on every ViewUpdate', () => {
    assert.match(sync, /for \(const listener of viewUpdateListeners\)/);
    assert.equal(/if \(update\.docChanged \|\| update\.selectionSet \|\| update\.viewportChanged\)/.test(sync), false);
  });
});
