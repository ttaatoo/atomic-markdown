import { StateField, type EditorState, type Extension } from '@codemirror/state';
import {
  repositionTooltips,
  showTooltip,
  tooltips,
  type Tooltip,
  type TooltipView,
  type EditorView,
} from '@codemirror/view';
import type { FormatAction } from '../src/protocol.ts';
import { applyFormat } from './format.ts';
import {
  SAFE_DEFAULT_ANCHOR,
  contentDefaultAnchor,
  readCoordsAtPos,
  selectionLayerAnchor,
} from './selectionBar.ts';
import { requestCopyText, requestSendToChat, selectionChatPayload } from './sendToChat.ts';

export type SelectionCardMode = 'selection' | 'global';

export function selectionMenuFlags(state: { selection: { main: { empty: boolean } } }): { show: boolean } {
  return { show: !state.selection.main.empty };
}

export function shouldShowFormatTooltip(state: EditorState): boolean {
  return selectionMenuFlags(state).show;
}

export function quoteSelectionPreview(text: string, max = 28): string {
  const one = text.replace(/\s+/g, ' ').trim();
  if (!one) {
    return '""';
  }
  if (one.length <= max) {
    return `"${one}"`;
  }
  return `"${one.slice(0, Math.max(1, max - 1)).trimEnd()}…"`;
}

export function sendShortcutHint(platform: string): string {
  return /Mac|iPhone|iPad/i.test(platform) ? '⌘↵' : 'Ctrl+Enter';
}

export function formatTooltipForState(state: EditorState): Tooltip | null {
  if (!shouldShowFormatTooltip(state)) {
    return null;
  }
  const sel = state.selection.main;
  return {
    pos: sel.from,
    end: sel.to,
    above: true,
    clip: false,
    create(view) {
      return createSelectionTooltipView(view);
    },
  };
}

export const selectionFormatTooltipField = StateField.define<Tooltip | null>({
  create: formatTooltipForState,
  update(value, tr) {
    if (!tr.docChanged && !tr.selection && tr.startState.readOnly === tr.state.readOnly) {
      return value;
    }
    return formatTooltipForState(tr.state);
  },
  provide: (field) => showTooltip.from(field),
});

export function selectionFormatTooltip(): Extension {
  return [selectionFormatTooltipField, tooltips()];
}

export function dispatchSelectionFormat(view: EditorView, action: FormatAction): boolean {
  if (view.state.readOnly) {
    return false;
  }
  const sel = view.state.selection.main;
  const patch = applyFormat(view.state.doc.toString(), sel.from, sel.to, action);
  view.dispatch({
    changes: { from: patch.replaceFrom, to: patch.replaceTo, insert: patch.insert },
    selection: { anchor: patch.selectionFrom, head: patch.selectionTo },
    scrollIntoView: true,
  });
  view.focus();
  return true;
}

export function dismissSelectionTooltip(view: EditorView): boolean {
  const sel = view.state.selection.main;
  if (sel.empty) {
    return false;
  }
  view.dispatch({ selection: { anchor: sel.head } });
  return true;
}

let tooltipOpen = false;
let tooltipCloser: (() => boolean) | undefined;

export function isCommentComposerOpen(): boolean {
  return tooltipOpen;
}

/** Window-level Escape — dismisses the selection card even if the editor has focus. */
export function closeCommentComposer(): boolean {
  return tooltipCloser?.() ?? false;
}

export function registerComposerCloser(close: () => boolean): () => void {
  tooltipCloser = close;
  tooltipOpen = true;
  return () => {
    if (tooltipCloser === close) {
      tooltipCloser = undefined;
      tooltipOpen = false;
    }
  };
}

function iconSvg(path: string): string {
  return `<svg viewBox="0 0 20 20" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${path}</svg>`;
}

const ICON_COMMENT = iconSvg('<path d="M4 5.2h12v7.2H8.2L4 15.6V5.2z"/>');
const ICON_GLOBE = iconSvg(
  '<circle cx="10" cy="10" r="6"/><path d="M4 10h12M10 4c2 2.2 2 9.8 0 12M10 4c-2 2.2-2 9.8 0 12"/>',
);
const ICON_COPY = iconSvg('<rect x="7" y="7" width="8" height="8" rx="1.2"/><path d="M5 13V5h8"/>');
const ICON_CHECK = iconSvg('<path d="M5 10.2 8.4 13.4 15 6.6"/>');
const ICON_EXPAND = iconSvg('<path d="M8 4H4v4M12 16h4v-4M4 8 8 4M16 12l-4 4"/>');
const ICON_CLOSE = iconSvg('<path d="M5 5l10 10M15 5 5 15"/>');

export function createSelectionContextElement(options: {
  selectionText: string;
  platform?: string;
  onSend: (mode: SelectionCardMode, comment: string) => void;
  onCopy: () => void;
  onDismiss: () => void;
  onLayout?: () => void;
}): HTMLDivElement {
  const platform = options.platform ?? '';
  const root = document.createElement('div');
  root.className = 'selection-format-bar selection-context';
  root.setAttribute('role', 'dialog');
  root.setAttribute('aria-label', 'Selection');
  root.addEventListener('mousedown', (event) => {
    const target = event.target as HTMLElement | null;
    if (target?.closest('textarea, input')) {
      return;
    }
    event.preventDefault();
  });

  const pills = document.createElement('div');
  pills.className = 'selection-pills';

  const commentPill = pillButton('comment', 'Comment', ICON_COMMENT);
  const globalPill = pillButton('global', 'Global comment', ICON_GLOBE);
  const copyPill = pillButton('copy', 'Copy', ICON_COPY);

  const card = document.createElement('div');
  card.className = 'selection-card';
  card.dataset.mode = 'selection';

  const header = document.createElement('div');
  header.className = 'selection-card-head';

  const title = document.createElement('div');
  title.className = 'selection-card-title';
  title.textContent = quoteSelectionPreview(options.selectionText);

  const headActions = document.createElement('div');
  headActions.className = 'selection-card-head-actions';

  const expand = document.createElement('button');
  expand.type = 'button';
  expand.className = 'selection-card-icon-btn';
  expand.setAttribute('aria-label', 'Expand comment');
  expand.innerHTML = ICON_EXPAND;

  const close = document.createElement('button');
  close.type = 'button';
  close.className = 'selection-card-icon-btn';
  close.setAttribute('aria-label', 'Close');
  close.innerHTML = ICON_CLOSE;

  const textarea = document.createElement('textarea');
  textarea.className = 'selection-card-input';
  textarea.rows = 3;
  textarea.placeholder = 'Add a comment…';
  textarea.setAttribute('aria-label', 'Comment');

  const footer = document.createElement('div');
  footer.className = 'selection-card-foot';

  const hint = document.createElement('span');
  hint.className = 'selection-card-hint';
  hint.textContent = sendShortcutHint(platform);

  const send = document.createElement('button');
  send.type = 'button';
  send.className = 'selection-card-send';
  send.textContent = 'Send';

  let mode: SelectionCardMode = 'selection';

  const setMode = (next: SelectionCardMode) => {
    mode = next;
    card.dataset.mode = next;
    commentPill.setAttribute('aria-pressed', next === 'selection' ? 'true' : 'false');
    globalPill.setAttribute('aria-pressed', next === 'global' ? 'true' : 'false');
    if (next === 'global') {
      title.textContent = 'Global Comment';
      title.classList.add('selection-card-title-plain');
      textarea.placeholder = 'Add a global comment…';
      send.textContent = 'Add';
    } else {
      title.textContent = quoteSelectionPreview(options.selectionText);
      title.classList.remove('selection-card-title-plain');
      textarea.placeholder = 'Add a comment…';
      send.textContent = 'Send';
    }
    textarea.focus();
    options.onLayout?.();
  };

  commentPill.addEventListener('click', (event) => {
    event.preventDefault();
    setMode('selection');
  });
  globalPill.addEventListener('click', (event) => {
    event.preventDefault();
    setMode('global');
  });
  copyPill.addEventListener('click', (event) => {
    event.preventDefault();
    options.onCopy();
    copyPill.dataset.copied = 'true';
    copyPill.innerHTML = `${ICON_CHECK}<span>Copied</span>`;
    window.setTimeout(() => {
      copyPill.dataset.copied = 'false';
      copyPill.innerHTML = `${ICON_COPY}<span>Copy</span>`;
    }, 1200);
  });
  expand.addEventListener('click', (event) => {
    event.preventDefault();
    const next = card.dataset.expanded !== 'true';
    card.dataset.expanded = next ? 'true' : 'false';
    expand.setAttribute('aria-pressed', next ? 'true' : 'false');
    textarea.rows = next ? 8 : 3;
    options.onLayout?.();
  });
  close.addEventListener('click', (event) => {
    event.preventDefault();
    options.onDismiss();
  });
  send.addEventListener('click', (event) => {
    event.preventDefault();
    options.onSend(mode, textarea.value);
  });
  textarea.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      options.onDismiss();
      return;
    }
    if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      options.onSend(mode, textarea.value);
    }
  });

  commentPill.setAttribute('aria-pressed', 'true');
  globalPill.setAttribute('aria-pressed', 'false');

  headActions.append(expand, close);
  header.append(title, headActions);
  footer.append(hint, send);
  pills.append(commentPill, globalPill, copyPill);
  card.append(header, textarea, footer);
  root.append(pills, card);
  return root;
}

function pillButton(id: string, label: string, icon: string): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'selection-pill';
  button.dataset.pill = id;
  button.innerHTML = `${icon}<span>${label}</span>`;
  return button;
}

export function tooltipAnchorRect(
  view: {
    coordsAtPos(pos: number, side?: -1 | 1): { top: number; bottom: number; left: number; right: number } | null;
    scrollDOM?: Element;
    dom?: Element;
    contentDOM?: Element;
  },
  pos: number,
): { top: number; bottom: number; left: number; right: number } {
  const coords = readCoordsAtPos((p, side) => view.coordsAtPos(p, side), pos, 1);
  if (coords) {
    return coords;
  }
  const layer = selectionLayerAnchor(view.scrollDOM ?? null) ?? selectionLayerAnchor(view.dom ?? null);
  if (layer) {
    return layer;
  }
  return contentDefaultAnchor(view.contentDOM?.getBoundingClientRect()) ?? SAFE_DEFAULT_ANCHOR;
}

function createSelectionTooltipView(view: EditorView): TooltipView {
  const sel = view.state.selection.main;
  const from = Math.min(sel.from, sel.to);
  const to = Math.max(sel.from, sel.to);
  const selectionText = view.state.doc.sliceString(from, to);
  const platform = typeof navigator === 'undefined' ? '' : navigator.platform;
  const layout = () => {
    try {
      repositionTooltips(view);
    } catch {
      // Best-effort.
    }
  };
  const dismiss = () => {
    dismissSelectionTooltip(view);
  };
  const dom = createSelectionContextElement({
    selectionText,
    platform,
    onSend: (mode, comment) => {
      requestSendToChat(selectionChatPayload(view, mode === 'global' ? 'global' : 'selection', comment));
    },
    onCopy: () => {
      const current = view.state.selection.main;
      const start = Math.min(current.from, current.to);
      const end = Math.max(current.from, current.to);
      requestCopyText(view.state.doc.sliceString(start, end));
    },
    onDismiss: dismiss,
    onLayout: layout,
  });
  const unregister = registerComposerCloser(() => dismissSelectionTooltip(view));
  return {
    dom,
    offset: { x: 0, y: 10 },
    resize: false,
    getCoords: (pos) => tooltipAnchorRect(view, pos),
    mount() {
      const input = dom.querySelector<HTMLTextAreaElement>('.selection-card-input');
      input?.focus();
    },
    destroy() {
      unregister();
    },
  };
}
