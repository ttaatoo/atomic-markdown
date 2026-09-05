import type { SendToChatMessage, SendToChatMode } from '../src/protocol.ts';

export type SendToChatRequest = Omit<SendToChatMessage, 'type'>;

type ChatHandler = (request: SendToChatRequest) => void;
type CopyHandler = (text: string) => void;

let chatHandler: ChatHandler | undefined;
let copyHandler: CopyHandler | undefined;

export function setSendToChatHandler(next: ChatHandler | undefined): void {
  chatHandler = next;
}

export function setCopyTextHandler(next: CopyHandler | undefined): void {
  copyHandler = next;
}

export function requestSendToChat(request: SendToChatRequest): boolean {
  if (!chatHandler) {
    return false;
  }
  chatHandler(request);
  return true;
}

export function requestCopyText(text: string): boolean {
  if (!copyHandler) {
    return false;
  }
  copyHandler(text);
  return true;
}

export function selectionChatPayload(
  view: {
    state: {
      selection: { main: { from: number; to: number } };
      doc: { sliceString(from: number, to: number): string; toString(): string };
    };
  },
  mode: SendToChatMode,
  comment?: string,
): SendToChatRequest {
  const sel = view.state.selection.main;
  const from = Math.min(sel.from, sel.to);
  const to = Math.max(sel.from, sel.to);
  const text = mode === 'global' ? view.state.doc.toString() : view.state.doc.sliceString(from, to);
  const payload: SendToChatRequest = { mode, text, from, to };
  if (comment !== undefined) {
    payload.comment = comment;
  }
  return payload;
}
