import { toLineFeed } from './text.ts';

export const CHAT_OPEN_COMMAND = 'workbench.action.chat.open';
export const CHAT_FALLBACK_NEW_COMMAND = 'composer.newAgentChat';
export const CHAT_FALLBACK_PASTE_COMMAND = 'editor.action.clipboardPasteAction';

export type SendToChatMode = 'selection' | 'comment';

export interface ChatPromptInput {
  path: string;
  startLine: number;
  endLine: number;
  text: string;
  comment?: string;
}

export interface LineRange {
  startLine: number;
  endLine: number;
}

/**
 * 1-based line span for a CM/LF offset range. A selection that ends on a
 * newline counts as the previous line (exclusive end).
 */
export function lineRangeFromLfOffsets(text: string, from: number, to: number): LineRange {
  const source = toLineFeed(text);
  const start = clamp(Math.min(from, to), 0, source.length);
  const end = clamp(Math.max(from, to), 0, source.length);
  const startLine = lineNumberAt(source, start);
  let endLine = lineNumberAt(source, end);
  if (end > start && source[end - 1] === '\n' && endLine > startLine) {
    endLine -= 1;
  }
  return { startLine, endLine: Math.max(startLine, endLine) };
}

export function buildChatPrompt(input: ChatPromptInput): string {
  const comment = input.comment?.trim();
  const lines: string[] = [];
  if (comment) {
    lines.push(`Comment: ${comment}`, '');
  }
  lines.push(`File: ${input.path}:${input.startLine}-${input.endLine}`, '');
  lines.push('```markdown', input.text, '```');
  return lines.join('\n');
}

export function planSendToChat(input: {
  mode: SendToChatMode;
  text: string;
  from: number;
  to: number;
  comment?: string;
  path: string;
  documentText: string;
}): { prompt: string } & LineRange {
  const range = lineRangeFromLfOffsets(input.documentText, input.from, input.to);
  const comment = input.mode === 'comment' ? input.comment : undefined;
  return {
    ...range,
    prompt: buildChatPrompt({
      path: input.path,
      startLine: range.startLine,
      endLine: range.endLine,
      text: input.text,
      comment,
    }),
  };
}

export interface ChatCommandBridge {
  getCommands(): Thenable<string[]>;
  executeCommand(command: string, ...args: unknown[]): Thenable<unknown>;
  writeClipboard(text: string): Thenable<void>;
}

/**
 * Prefer Cursor/VS Code `workbench.action.chat.open` with the prompt string.
 * If that command is missing, copy the prompt and open `composer.newAgentChat`
 * then paste — a documented fallback, not native reference chips.
 */
export async function openCursorChat(
  prompt: string,
  cmds: ChatCommandBridge,
): Promise<'opened' | 'clipboard-fallback'> {
  const available = new Set(await cmds.getCommands());
  if (available.has(CHAT_OPEN_COMMAND)) {
    await cmds.executeCommand(CHAT_OPEN_COMMAND, prompt);
    return 'opened';
  }
  await cmds.writeClipboard(prompt);
  if (available.has(CHAT_FALLBACK_NEW_COMMAND)) {
    await cmds.executeCommand(CHAT_FALLBACK_NEW_COMMAND);
  }
  if (available.has(CHAT_FALLBACK_PASTE_COMMAND)) {
    await cmds.executeCommand(CHAT_FALLBACK_PASTE_COMMAND);
  }
  return 'clipboard-fallback';
}

function lineNumberAt(text: string, offset: number): number {
  let line = 1;
  for (let i = 0; i < offset; i++) {
    if (text[i] === '\n') {
      line += 1;
    }
  }
  return line;
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}
