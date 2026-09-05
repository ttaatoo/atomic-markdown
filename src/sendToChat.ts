import { toLineFeed } from './text.ts';
import type { SendToChatMode } from './protocol.ts';

export const CHAT_OPEN_COMMAND = 'workbench.action.chat.open';
export const CHAT_FALLBACK_NEW_COMMAND = 'composer.newAgentChat';
export const CHAT_FALLBACK_PASTE_COMMAND = 'editor.action.clipboardPasteAction';
export const GLOBAL_FILE_FENCE_MAX_CHARS = 8000;

export interface ChatPromptInput {
  path: string;
  startLine?: number;
  endLine?: number;
  text?: string;
  comment?: string;
  mode?: SendToChatMode;
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
  const mode = input.mode === 'global' ? 'global' : 'selection';
  const lines: string[] = [];
  if (comment) {
    lines.push(`Comment: ${comment}`, '');
  }
  if (mode === 'global') {
    lines.push(`File: ${input.path}`, '');
    if (input.text) {
      lines.push('```markdown', input.text, '```');
    } else {
      lines.push('Global comment on file');
    }
    return lines.join('\n');
  }
  const start = input.startLine ?? 1;
  const end = input.endLine ?? start;
  lines.push(`File: ${input.path}:${start}-${end}`, '');
  lines.push('```markdown', input.text ?? '', '```');
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
  const comment = input.comment?.trim() || undefined;
  if (input.mode === 'global') {
    const full = toLineFeed(input.documentText);
    const fence = full.length <= GLOBAL_FILE_FENCE_MAX_CHARS;
    const endLine = Math.max(1, lineNumberAt(full, full.length));
    return {
      startLine: 1,
      endLine,
      prompt: buildChatPrompt({
        mode: 'global',
        path: input.path,
        comment,
        text: fence ? full : undefined,
      }),
    };
  }
  const range = lineRangeFromLfOffsets(input.documentText, input.from, input.to);
  return {
    ...range,
    prompt: buildChatPrompt({
      mode: 'selection',
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
