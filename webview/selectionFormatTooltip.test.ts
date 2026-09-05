import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import { EditorState } from '@codemirror/state';
import { showTooltip } from '@codemirror/view';
import {
  closeCommentComposer,
  createSelectionContextElement,
  formatTooltipForState,
  quoteSelectionPreview,
  registerComposerCloser,
  selectionFormatTooltip,
  selectionFormatTooltipField,
  selectionMenuFlags,
  sendShortcutHint,
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
  it('produces an above tooltip for a non-empty selection', () => {
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

  it('hides when the selection is empty', () => {
    const empty = stateWithSelection({ empty: true });
    assert.equal(shouldShowFormatTooltip(empty), false);
    assert.equal(empty.field(selectionFormatTooltipField), null);
    assert.deepEqual(selectionMenuFlags(empty), { show: false });
  });

  it('still shows the capsule in reading mode', () => {
    const reading = stateWithSelection({ readOnly: true });
    assert.equal(shouldShowFormatTooltip(reading), true);
    assert.deepEqual(selectionMenuFlags(reading), { show: true });
    assert.ok(reading.field(selectionFormatTooltipField));
  });

  it('quotes a truncated selection preview', () => {
    assert.equal(quoteSelectionPreview('hello'), '"hello"');
    assert.equal(quoteSelectionPreview('Raw markdown is the source of truth.'), '"Raw markdown is the source…"');
    assert.equal(quoteSelectionPreview('  a\n b  '), '"a b"');
    assert.equal(quoteSelectionPreview('   '), '""');
  });

  it('uses a Mac or Ctrl send hint', () => {
    assert.equal(sendShortcutHint('MacIntel'), '⌘↵');
    assert.equal(sendShortcutHint('Win32'), 'Ctrl+Enter');
  });

  it('closes the card via closeCommentComposer (window Escape path)', () => {
    let open = true;
    const unreg = registerComposerCloser(() => {
      if (!open) {
        return false;
      }
      open = false;
      return true;
    });
    assert.equal(closeCommentComposer(), true);
    assert.equal(open, false);
    assert.equal(closeCommentComposer(), false);
    unreg();
    assert.equal(closeCommentComposer(), false);
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

describe('CM tooltip is wired; format icons are gone', () => {
  const root = join(dirname(fileURLToPath(import.meta.url)), '..');
  const app = readFileSync(join(root, 'webview/App.tsx'), 'utf8');
  const sync = readFileSync(join(root, 'webview/sync.ts'), 'utf8');
  const css = readFileSync(join(root, 'webview/theme.css'), 'utf8');
  const tooltip = readFileSync(join(root, 'webview/selectionFormatTooltip.ts'), 'utf8');

  it('composes the tooltip through EXTRA_EXTENSIONS without format edit buttons', () => {
    assert.match(sync, /selectionFormatTooltip\(\)/);
    assert.match(app, /extensions=\{EXTRA_EXTENSIONS\}/);
    assert.match(app, /setSendToChatHandler/);
    assert.match(app, /setCopyTextHandler/);
    assert.match(app, /closeCommentComposer/);
    assert.equal(app.includes('SelectionFormatBar'), false);
    assert.equal(tooltip.includes('Add to Chat'), false);
    assert.equal(tooltip.includes('SELECTION_FORMAT_ACTIONS'), false);
    assert.equal(/send\.disabled\s*=/.test(tooltip), false);
    assert.equal(tooltip.includes('Global comment'), false);
    assert.equal(tooltip.includes('requestCopyText'), false);
    assert.match(tooltip, /selection-capsule/);
    assert.match(tooltip, /Send to chat/);
    assert.match(app, /DocActions/);
    assert.match(app, /globalCommentOpen/);
    assert.match(css, /\.selection-card:not\(\[hidden\]\)/);
    assert.match(css, /\.selection-capsule/);
    assert.match(css, /\.doc-pills:not\(\[hidden\]\)/);
    assert.match(css, /\.selection-card-send/);
    assert.equal(css.includes('.selection-format-group'), false);
    assert.equal(css.includes('.selection-format-btn'), false);
    assert.equal(css.includes('.selection-pills'), false);
  });

  it('notifies view-update listeners on every ViewUpdate', () => {
    assert.match(sync, /for \(const listener of viewUpdateListeners\)/);
    assert.equal(/if \(update\.docChanged \|\| update\.selectionSet \|\| update\.viewportChanged\)/.test(sync), false);
  });
});

class MiniEl {
  tagName: string;
  children: MiniEl[] = [];
  parent: MiniEl | null = null;
  listeners: Record<string, Array<(event: Record<string, unknown>) => void>> = {};
  attributes: Record<string, string> = {};
  className = '';
  type = '';
  rows = 2;
  placeholder = '';
  value = '';
  focused = false;
  innerHTML = '';
  textContent = '';
  dataset: Record<string, string>;

  constructor(tag: string) {
    this.tagName = tag.toUpperCase();
    const attributes = this.attributes;
    this.dataset = new Proxy(
      {},
      {
        get: (target, key) => (typeof key === 'string' ? target[key] : undefined),
        set: (target, key, value) => {
          if (typeof key !== 'string') {
            return false;
          }
          const text = String(value);
          target[key] = text;
          attributes[`data-${key.replace(/[A-Z]/g, (ch) => `-${ch.toLowerCase()}`)}`] = text;
          return true;
        },
      },
    );
  }

  get classList() {
    const tokens = () => this.className.split(/\s+/).filter(Boolean);
    return {
      add: (...names: string[]) => {
        this.className = [...new Set([...tokens(), ...names])].join(' ');
      },
      remove: (...names: string[]) => {
        const drop = new Set(names);
        this.className = tokens()
          .filter((name) => !drop.has(name))
          .join(' ');
      },
      contains: (name: string) => tokens().includes(name),
    };
  }

  setAttribute(name: string, value: string) {
    this.attributes[name] = String(value);
  }

  getAttribute(name: string) {
    return Object.prototype.hasOwnProperty.call(this.attributes, name) ? this.attributes[name] : null;
  }

  hasAttribute(name: string) {
    return Object.prototype.hasOwnProperty.call(this.attributes, name);
  }

  removeAttribute(name: string) {
    delete this.attributes[name];
  }

  addEventListener(type: string, fn: (event: Record<string, unknown>) => void) {
    (this.listeners[type] ??= []).push(fn);
  }

  append(...nodes: MiniEl[]) {
    for (const node of nodes) {
      node.parent = this;
      this.children.push(node);
    }
  }

  focus() {
    this.focused = true;
  }

  querySelector(sel: string): MiniEl | null {
    if (matchesSelector(this, sel)) {
      return this;
    }
    for (const child of this.children) {
      const hit = child.querySelector(sel);
      if (hit) {
        return hit;
      }
    }
    return null;
  }

  closest(sel: string): MiniEl | null {
    let node: MiniEl | null = this;
    while (node) {
      if (matchesSelector(node, sel)) {
        return node;
      }
      node = node.parent;
    }
    return null;
  }

  dispatch(type: string, extra: Record<string, unknown> = {}) {
    const event = {
      type,
      target: this,
      preventDefault() {},
      stopPropagation() {},
      ...extra,
    };
    for (const fn of this.listeners[type] ?? []) {
      fn(event);
    }
  }
}

function matchesSelector(el: MiniEl, sel: string): boolean {
  return sel.split(',').some((part) => {
    const token = part.trim();
    if (!token) {
      return false;
    }
    if (token.startsWith('.')) {
      return el.classList.contains(token.slice(1));
    }
    return el.tagName === token.toUpperCase();
  });
}

function installMiniDom() {
  const document = {
    createElement: (tag: string) => new MiniEl(tag),
  };
  (globalThis as { document?: typeof document }).document = document;
  if (!(globalThis as { window?: typeof globalThis }).window) {
    (globalThis as { window?: typeof globalThis }).window = globalThis;
  }
}

describe('createSelectionContextElement', () => {
  installMiniDom();

  function mount() {
    const sent: string[] = [];
    const quick: number[] = [];
    const dismisses: number[] = [];
    const root = createSelectionContextElement({
      selectionText: 'Raw markdown is the source of truth.',
      platform: 'MacIntel',
      onSend: (comment) => {
        sent.push(comment);
      },
      onQuickSend: () => {
        quick.push(1);
      },
      onDismiss: () => {
        dismisses.push(1);
      },
    });
    const send = root.querySelector('.selection-card-send') as MiniEl;
    const input = root.querySelector('.selection-card-input') as MiniEl;
    const title = root.querySelector('.selection-card-title') as MiniEl;
    const card = root.querySelector('.selection-card') as MiniEl;
    const capsule = root.querySelector('.selection-capsule') as MiniEl;
    return { root, send, input, title, card, capsule, sent, quick, dismisses };
  }

  function findByAria(root: MiniEl, label: string): MiniEl {
    const walk = (el: MiniEl): MiniEl | null => {
      if (el.getAttribute('aria-label') === label) {
        return el;
      }
      for (const child of el.children) {
        const hit = walk(child);
        if (hit) {
          return hit;
        }
      }
      return null;
    };
    const found = walk(root);
    assert.ok(found, `missing ${label}`);
    return found;
  }

  it('shows a capsule only until Comment opens the card', () => {
    const ui = mount();
    assert.ok(ui.capsule);
    assert.equal(ui.card.hasAttribute('hidden'), true);
    assert.equal(findByAria(ui.root, 'Comment').getAttribute('aria-pressed'), 'false');
    assert.equal(ui.root.querySelector('.selection-format-group'), null);
    assert.equal(ui.title.textContent, '"Raw markdown is the source…"');

    findByAria(ui.root, 'Comment').dispatch('click');
    assert.equal(ui.card.hasAttribute('hidden'), false);
    assert.equal(ui.input.placeholder, 'Add a comment…');
    assert.equal(ui.send.textContent, 'Send');
    assert.equal(ui.send.attributes.disabled, undefined);
    ui.send.dispatch('click');
    assert.deepEqual(ui.sent, ['']);
  });

  it('quick-sends from lightning without opening the card', () => {
    const ui = mount();
    findByAria(ui.root, 'Send to chat').dispatch('click');
    assert.deepEqual(ui.quick, [1]);
    assert.deepEqual(ui.sent, []);
    assert.equal(ui.card.hasAttribute('hidden'), true);
  });

  it('closes the card without dismissing, and dismisses from the capsule X', () => {
    const ui = mount();
    findByAria(ui.root, 'Comment').dispatch('click');
    findByAria(ui.root, 'Expand comment').dispatch('click');
    assert.equal(ui.card.dataset.expanded, 'true');
    assert.equal(ui.input.rows, 8);

    findByAria(ui.root, 'Close comment').dispatch('click');
    assert.equal(ui.card.hasAttribute('hidden'), true);
    assert.deepEqual(ui.dismisses, []);

    findByAria(ui.root, 'Dismiss').dispatch('click');
    assert.deepEqual(ui.dismisses, [1]);
    assert.deepEqual(ui.sent, []);
    assert.deepEqual(ui.quick, []);
  });

  it('sends on ⌘↵ from the textarea', () => {
    const ui = mount();
    findByAria(ui.root, 'Comment').dispatch('click');
    ui.input.value = 'please look';
    ui.input.dispatch('keydown', { key: 'Enter', metaKey: true, ctrlKey: false });
    assert.deepEqual(ui.sent, ['please look']);
  });
});
