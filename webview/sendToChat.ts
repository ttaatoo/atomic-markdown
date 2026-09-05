import type { SendToChatMessage } from '../src/protocol.ts';

export type SendToChatRequest = Omit<SendToChatMessage, 'type'>;

type Handler = (request: SendToChatRequest) => void;

let handler: Handler | undefined;

export function setSendToChatHandler(next: Handler | undefined): void {
  handler = next;
}

export function requestSendToChat(request: SendToChatRequest): boolean {
  if (!handler) {
    return false;
  }
  handler(request);
  return true;
}

export function selectionChatPayload(
  view: { state: { selection: { main: { from: number; to: number } }; doc: { sliceString(from: number, to: number): string } } },
  mode: SendToChatRequest['mode'],
  comment?: string,
): SendToChatRequest {
  const sel = view.state.selection.main;
  const from = Math.min(sel.from, sel.to);
  const to = Math.max(sel.from, sel.to);
  const payload: SendToChatRequest = {
    mode,
    text: view.state.doc.sliceString(from, to),
    from,
    to,
  };
  if (mode === 'comment' && comment !== undefined) {
    payload.comment = comment;
  }
  return payload;
}
