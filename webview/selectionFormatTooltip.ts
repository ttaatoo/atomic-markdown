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
import { detectFormatActive, type FormatActiveMap } from './formatActive.ts';
import {
  SAFE_DEFAULT_ANCHOR,
  SELECTION_FORMAT_ACTIONS,
  contentDefaultAnchor,
  readCoordsAtPos,
  selectionLayerAnchor,
} from './selectionBar.ts';
import { requestSendToChat, selectionChatPayload } from './sendToChat.ts';
import { formatActionTitle } from './toolbarLabels.ts';

const INLINE_ICONS: Partial<Record<FormatAction, string>> = {
  bold: '<path d="M5 4h6.2c2.3 0 3.8 1.4 3.8 3.3 0 1.4-.8 2.5-2.1 3 .9.3 2.6 1.3 2.6 3.2 0 2.2-1.7 3.5-4.2 3.5H5V4zm2.6 5.4h3.3c1 0 1.6-.6 1.6-1.4S11.9 6.6 10.9 6.6H7.6v2.8zm0 5.4h3.7c1.2 0 1.9-.6 1.9-1.6s-.7-1.6-1.9-1.6H7.6V14.8z"/>',
  italic: '<path d="M9.2 4h6.1v1.8H12.4l-2.6 8.4h2.7V16H6.3v-1.8h2.8L11.7 5.8H9.2V4z"/>',
  strike:
    '<path fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" d="M4 10h12"/><path fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" d="M7.2 13.8c.5 1.1 1.6 1.8 3 1.8 2 0 3.4-1.1 3.4-2.7 0-2.2-2.2-2.6-4.4-3.2C7.2 9.1 5.8 8.3 5.8 6.5 5.8 4.7 7.4 3.5 9.8 3.5c1.6 0 2.8.6 3.5 1.6"/>',
  inlineCode:
    '<path fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" d="M6.2 5.5 2.8 10l3.4 4.5M13.8 5.5 17.2 10l-3.4 4.5M11.2 3.8 8.8 16.2"/>',
  link: '<path fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" d="M8.2 11.8 6.4 13.6a2.4 2.4 0 0 0 3.4 3.4l2.4-2.4M11.8 8.2l1.8-1.8a2.4 2.4 0 1 1 3.4 3.4l-2.4 2.4M8.7 11.3l2.6-2.6"/>',
};

export function selectionMenuFlags(state: { readOnly: boolean; selection: { main: { empty: boolean } } }): {
  show: boolean;
  showFormat: boolean;
} {
  const show = !state.selection.main.empty;
  return { show, showFormat: show && !state.readOnly };
}

/** Non-empty CM selection — format icons only in edit mode. */
export function shouldShowFormatTooltip(state: EditorState): boolean {
  return selectionMenuFlags(state).show;
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
      return createFormatTooltipView(view);
    },
  };
}

export const selectionFormatTooltipField = StateField.define<Tooltip | null>({
  create: formatTooltipForState,
  update(value, tr) {
    if (
      !tr.docChanged &&
      !tr.selection &&
      tr.startState.readOnly === tr.state.readOnly
    ) {
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

let composerOpen = false;
let composerCloser: (() => boolean) | undefined;

export function isCommentComposerOpen(): boolean {
  return composerOpen;
}

export function closeCommentComposer(): boolean {
  if (!composerOpen || !composerCloser) {
    return false;
  }
  return composerCloser();
}

function registerComposerCloser(close: () => boolean): () => void {
  composerCloser = close;
  return () => {
    if (composerCloser === close) {
      composerCloser = undefined;
      composerOpen = false;
    }
  };
}

export function createSelectionFormatBarElement(
  onFormat: (action: FormatAction) => void,
  active: FormatActiveMap,
  platform = '',
  options?: {
    showFormat?: boolean;
    onAddToChat?: () => void;
    onSendComment?: (comment: string) => void;
    onComposerChange?: (open: boolean) => void;
  },
): HTMLDivElement {
  const showFormat = options?.showFormat !== false;
  const bar = document.createElement('div');
  bar.className = 'selection-format-bar';
  bar.setAttribute('role', 'toolbar');
  bar.setAttribute('aria-label', 'Selection');
  bar.addEventListener('mousedown', (event) => {
    const target = event.target as HTMLElement | null;
    if (target?.closest('textarea, input')) {
      return;
    }
    event.preventDefault();
  });

  const row = document.createElement('div');
  row.className = 'selection-format-row';

  const formatGroup = document.createElement('div');
  formatGroup.className = 'selection-format-group';
  formatGroup.hidden = !showFormat;
  for (const action of SELECTION_FORMAT_ACTIONS) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'selection-format-btn';
    button.dataset.format = action;
    const title = formatActionTitle(action, platform);
    button.setAttribute('aria-label', title);
    button.title = title;
    button.setAttribute('aria-pressed', active[action] ? 'true' : 'false');
    button.addEventListener('click', (event) => {
      event.preventDefault();
      onFormat(action);
    });
    const svg = INLINE_ICONS[action];
    if (svg) {
      button.innerHTML = `<svg class="selection-format-icon" viewBox="0 0 20 20" width="14" height="14" fill="currentColor" aria-hidden="true">${svg}</svg>`;
    }
    formatGroup.appendChild(button);
  }

  const sep = document.createElement('span');
  sep.className = 'selection-format-sep';
  sep.setAttribute('aria-hidden', 'true');
  sep.hidden = !showFormat;

  const addChat = document.createElement('button');
  addChat.type = 'button';
  addChat.className = 'selection-chat-btn';
  addChat.dataset.chat = 'selection';
  addChat.textContent = 'Add to Chat';
  addChat.title = 'Send the selection to Cursor Chat';
  addChat.addEventListener('click', (event) => {
    event.preventDefault();
    options?.onAddToChat?.();
  });

  const addComment = document.createElement('button');
  addComment.type = 'button';
  addComment.className = 'selection-chat-btn';
  addComment.dataset.chat = 'comment';
  addComment.textContent = 'Add Comment';
  addComment.title = 'Comment on the selection in Cursor Chat';
  addComment.setAttribute('aria-pressed', 'false');

  const composer = document.createElement('div');
  composer.className = 'selection-comment-composer';
  composer.hidden = true;

  const textarea = document.createElement('textarea');
  textarea.className = 'selection-comment-input';
  textarea.rows = 3;
  textarea.placeholder = 'Add a comment…';
  textarea.setAttribute('aria-label', 'Comment');

  const actions = document.createElement('div');
  actions.className = 'selection-comment-actions';

  const cancel = document.createElement('button');
  cancel.type = 'button';
  cancel.className = 'selection-comment-cancel';
  cancel.textContent = 'Cancel';

  const send = document.createElement('button');
  send.type = 'button';
  send.className = 'selection-comment-send';
  send.textContent = 'Send';
  send.disabled = true;

  const setComposerOpen = (next: boolean) => {
    composer.hidden = !next;
    addComment.setAttribute('aria-pressed', next ? 'true' : 'false');
    composerOpen = next;
    options?.onComposerChange?.(next);
    if (next) {
      textarea.focus();
    }
  };

  const syncSendEnabled = () => {
    send.disabled = textarea.value.trim().length === 0;
  };

  addComment.addEventListener('click', (event) => {
    event.preventDefault();
    setComposerOpen(composer.hidden);
  });
  cancel.addEventListener('click', (event) => {
    event.preventDefault();
    textarea.value = '';
    syncSendEnabled();
    setComposerOpen(false);
  });
  send.addEventListener('click', (event) => {
    event.preventDefault();
    const comment = textarea.value.trim();
    if (!comment) {
      return;
    }
    options?.onSendComment?.(comment);
    textarea.value = '';
    syncSendEnabled();
    setComposerOpen(false);
  });
  textarea.addEventListener('input', syncSendEnabled);
  textarea.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      setComposerOpen(false);
      return;
    }
    if (event.key === 'Enter' && (event.metaKey || event.ctrlKey) && !send.disabled) {
      event.preventDefault();
      send.click();
    }
  });

  actions.append(cancel, send);
  composer.append(textarea, actions);
  row.append(formatGroup, sep, addChat, addComment);
  bar.append(row, composer);

  bar.dataset.showFormat = showFormat ? 'true' : 'false';
  return bar;
}

export function syncSelectionMenu(bar: HTMLElement, state: EditorState): void {
  const flags = selectionMenuFlags(state);
  const formatGroup = bar.querySelector<HTMLElement>('.selection-format-group');
  const sep = bar.querySelector<HTMLElement>('.selection-format-sep');
  if (formatGroup) {
    formatGroup.hidden = !flags.showFormat;
  }
  if (sep) {
    sep.hidden = !flags.showFormat;
  }
  bar.dataset.showFormat = flags.showFormat ? 'true' : 'false';
  const sel = state.selection.main;
  const active = detectFormatActive(state.doc.toString(), sel.from, sel.to);
  for (const button of bar.querySelectorAll<HTMLButtonElement>('[data-format]')) {
    const action = button.dataset.format as FormatAction;
    button.setAttribute('aria-pressed', active[action] ? 'true' : 'false');
  }
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

function createFormatTooltipView(view: EditorView): TooltipView {
  const sel = view.state.selection.main;
  const platform = typeof navigator === 'undefined' ? '' : navigator.platform;
  const flags = selectionMenuFlags(view.state);
  const dom = createSelectionFormatBarElement(
    (action) => {
      dispatchSelectionFormat(view, action);
    },
    detectFormatActive(view.state.doc.toString(), sel.from, sel.to),
    platform,
    {
      showFormat: flags.showFormat,
      onAddToChat: () => {
        requestSendToChat(selectionChatPayload(view, 'selection'));
      },
      onSendComment: (comment) => {
        requestSendToChat(selectionChatPayload(view, 'comment', comment));
      },
      onComposerChange: () => {
        try {
          repositionTooltips(view);
        } catch {
          // Positioning is best-effort.
        }
      },
    },
  );
  const unregister = registerComposerCloser(() => {
    const composer = dom.querySelector<HTMLElement>('.selection-comment-composer');
    if (!composer || composer.hidden) {
      return false;
    }
    const cancel = dom.querySelector<HTMLButtonElement>('.selection-comment-cancel');
    cancel?.click();
    return true;
  });
  return {
    dom,
    offset: { x: 0, y: 8 },
    resize: false,
    getCoords: (pos) => tooltipAnchorRect(view, pos),
    update(update) {
      if (update.docChanged || update.selectionSet || update.startState.readOnly !== update.state.readOnly) {
        syncSelectionMenu(dom, update.state);
      }
    },
    destroy() {
      unregister();
    },
  };
}
