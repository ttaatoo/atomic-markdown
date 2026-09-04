import type { FormatAction } from '../src/protocol.ts';

export type FormatActiveMap = Partial<Record<FormatAction, boolean>>;

/**
 * Cheap selection/line checks for floating-bar pressed state.
 * Looks at the current line (lists/headings) and immediate wrap markers.
 */
const FORMAT_KEYS: FormatAction[] = [
  'bold',
  'italic',
  'strike',
  'inlineCode',
  'link',
  'heading',
  'bulletList',
  'numberedList',
  'taskList',
];

export function formatActiveEqual(a: FormatActiveMap, b: FormatActiveMap): boolean {
  return FORMAT_KEYS.every((key) => Boolean(a[key]) === Boolean(b[key]));
}

export function detectFormatActive(text: string, from: number, to: number): FormatActiveMap {
  const start = clamp(Math.min(from, to), 0, text.length);
  const end = clamp(Math.max(from, to), 0, text.length);
  const line = lineContaining(text, start);
  const rest = line.replace(/^[ \t]+/, '');

  const heading = /^#{1,6}[ \t]/.test(rest);
  const task = /^(?:[-*+]|\d+\.)[ \t]+\[[ xX]\][ \t]/.test(rest);
  const numbered = !task && /^\d+\.[ \t]/.test(rest);
  const bullet = !task && !numbered && /^[-*+][ \t]/.test(rest);

  return {
    bold: hasWrap(text, start, end, '**'),
    italic: hasItalic(text, start, end),
    strike: hasWrap(text, start, end, '~~'),
    inlineCode: hasWrap(text, start, end, '`'),
    link: isLinkActive(text, start, end),
    heading,
    bulletList: bullet,
    numberedList: numbered,
    taskList: task,
  };
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

function lineContaining(text: string, pos: number): string {
  let start = pos;
  while (start > 0 && text[start - 1] !== '\n') {
    start -= 1;
  }
  let end = pos;
  while (end < text.length && text[end] !== '\n') {
    end += 1;
  }
  return text.slice(start, end);
}

function hasWrap(text: string, from: number, to: number, marker: string): boolean {
  const selected = text.slice(from, to);
  if (
    selected.length >= marker.length * 2 &&
    selected.startsWith(marker) &&
    selected.endsWith(marker)
  ) {
    return true;
  }
  if (from !== to) {
    return false;
  }
  const before = text.lastIndexOf(marker, from - 1);
  if (before === -1) {
    return false;
  }
  const after = text.indexOf(marker, to);
  return after !== -1;
}

function hasItalic(text: string, from: number, to: number): boolean {
  if (hasWrap(text, from, to, '**')) {
    return false;
  }
  if (hasWrap(text, from, to, '*')) {
    return true;
  }
  if (from !== to) {
    return false;
  }
  const left = text[from - 1];
  const right = text[from];
  return left === '*' && right === '*' ? false : hasSingleStarPair(text, from);
}

function hasSingleStarPair(text: string, pos: number): boolean {
  let i = pos - 1;
  while (i >= 0 && text[i] !== '*') {
    if (text[i] === '\n') {
      return false;
    }
    i -= 1;
  }
  if (i < 0 || text[i - 1] === '*') {
    return false;
  }
  let j = pos;
  while (j < text.length && text[j] !== '*') {
    if (text[j] === '\n') {
      return false;
    }
    j += 1;
  }
  return j < text.length && text[j + 1] !== '*';
}

function isLinkActive(text: string, from: number, to: number): boolean {
  const selected = text.slice(from, to);
  if (/\[[^\]]*\]\([^)]*\)/.test(selected)) {
    return true;
  }
  if (from !== to) {
    return false;
  }
  const open = text.lastIndexOf('[', from);
  const close = text.indexOf(')', from);
  if (open === -1 || close === -1) {
    return false;
  }
  return /\[[^\]]*\]\([^)]*\)/.test(text.slice(open, close + 1));
}
