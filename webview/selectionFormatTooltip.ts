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
import { requestSendToChat, selectionChatPayload } from './sendToChat.ts';

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

/** Window-level Escape: close the comment card first, then dismiss the capsule. */
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

function iconSvg(path: string, filled = false): string {
  const paint = filled
    ? 'fill="currentColor" stroke="none"'
    : 'fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"';
  return `<svg viewBox="0 0 20 20" width="15" height="15" ${paint} aria-hidden="true">${path}</svg>`;
}

const ICON_COMMENT = iconSvg('<path d="M4 4.6h12a1 1 0 0 1 1 1V12a1 1 0 0 1-1 1H9.1L4 16.4V5.6a1 1 0 0 1 1-1z"/>', true);
const ICON_BOLT = iconSvg('<path d="M11.2 2.2 4.8 10.6h4.3l-.9 7.2 6.6-8.8H10.4l.8-6.8z"/>', true);
const ICON_EXPAND = iconSvg('<path d="M8 4H4v4M12 16h4v-4M4 8 8 4M16 12l-4 4"/>');
const ICON_CLOSE = iconSvg('<path d="M5 5l10 10M15 5 5 15"/>');

export function createSelectionContextElement(options: {
  selectionText: string;
  platform?: string;
  onSend: (comment: string) => void;
  onQuickSend: () => void;
  onDismiss: () => void;
  onLayout?: () => void;
}): HTMLDivElement {
  const platform = options.platform ?? '';
  const root = document.createElement('div');
  root.className = 'selection-format-bar selection-context';
  root.setAttribute('role', 'toolbar');
  root.setAttribute('aria-label', 'Selection');
  root.addEventListener('mousedown', (event) => {
    const target = event.target as HTMLElement | null;
    if (target?.closest('textarea, input')) {
      return;
    }
    event.preventDefault();
  });

  const capsule = document.createElement('div');
  capsule.className = 'selection-capsule';

  const commentBtn = capsuleButton('comment', 'Comment', ICON_COMMENT);
  const sendBtn = capsuleButton('send', 'Send to chat', ICON_BOLT);
  const dismissBtn = capsuleButton('dismiss', 'Dismiss', ICON_CLOSE);

  const divider = document.createElement('span');
  divider.className = 'selection-capsule-divider';
  divider.setAttribute('aria-hidden', 'true');

  const card = document.createElement('div');
  card.className = 'selection-card';
  card.setAttribute('hidden', '');

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

  const closeCard = document.createElement('button');
  closeCard.type = 'button';
  closeCard.className = 'selection-card-icon-btn';
  closeCard.setAttribute('aria-label', 'Close comment');
  closeCard.innerHTML = ICON_CLOSE;

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

  const setCardOpen = (next: boolean) => {
    if (next) {
      card.removeAttribute('hidden');
    } else {
      card.setAttribute('hidden', '');
    }
    commentBtn.setAttribute('aria-pressed', next ? 'true' : 'false');
    if (next) {
      textarea.focus();
    }
    options.onLayout?.();
  };

  const isCardOpen = () => !card.hasAttribute('hidden');

  commentBtn.addEventListener('click', (event) => {
    event.preventDefault();
    setCardOpen(!isCardOpen());
  });
  sendBtn.addEventListener('click', (event) => {
    event.preventDefault();
    options.onQuickSend();
  });
  dismissBtn.addEventListener('click', (event) => {
    event.preventDefault();
    options.onDismiss();
  });
  expand.addEventListener('click', (event) => {
    event.preventDefault();
    const next = card.dataset.expanded !== 'true';
    card.dataset.expanded = next ? 'true' : 'false';
    expand.setAttribute('aria-pressed', next ? 'true' : 'false');
    textarea.rows = next ? 8 : 3;
    options.onLayout?.();
  });
  closeCard.addEventListener('click', (event) => {
    event.preventDefault();
    setCardOpen(false);
  });
  send.addEventListener('click', (event) => {
    event.preventDefault();
    options.onSend(textarea.value);
  });
  textarea.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      setCardOpen(false);
      return;
    }
    if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      options.onSend(textarea.value);
    }
  });

  (root as HTMLDivElement & { closeSelectionCard?: () => boolean }).closeSelectionCard = () => {
    if (!isCardOpen()) {
      return false;
    }
    setCardOpen(false);
    return true;
  };

  commentBtn.setAttribute('aria-pressed', 'false');
  headActions.append(expand, closeCard);
  header.append(title, headActions);
  footer.append(hint, send);
  capsule.append(commentBtn, sendBtn, divider, dismissBtn);
  card.append(header, textarea, footer);
  root.append(capsule, card);
  return root;
}

function capsuleButton(id: string, label: string, icon: string): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'selection-capsule-btn';
  button.dataset.action = id;
  button.setAttribute('aria-label', label);
  button.innerHTML = icon;
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
  const sendSelection = (comment: string) => {
    requestSendToChat(selectionChatPayload(view, 'selection', comment));
  };
  const dom = createSelectionContextElement({
    selectionText,
    platform,
    onSend: sendSelection,
    onQuickSend: () => sendSelection(''),
    onDismiss: dismiss,
    onLayout: layout,
  });
  const closeCard = (dom as HTMLDivElement & { closeSelectionCard?: () => boolean }).closeSelectionCard;
  const unregister = registerComposerCloser(() => {
    if (closeCard?.()) {
      return true;
    }
    return dismissSelectionTooltip(view);
  });
  return {
    dom,
    offset: { x: 0, y: 10 },
    resize: false,
    getCoords: (pos) => tooltipAnchorRect(view, pos),
    destroy() {
      unregister();
    },
  };
}
