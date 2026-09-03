import type { FormatAction } from '../src/protocol.ts';

export type { FormatAction };

export interface FormatPatch {
  replaceFrom: number;
  replaceTo: number;
  insert: string;
  selectionFrom: number;
  selectionTo: number;
}

export function applyFormat(
  text: string,
  from: number,
  to: number,
  action: FormatAction,
): FormatPatch {
  const start = Math.max(0, Math.min(from, to, text.length));
  const end = Math.max(0, Math.min(Math.max(from, to), text.length));
  switch (action) {
    case 'bold':
      return wrapInline(text, start, end, '**', 'bold');
    case 'italic':
      return wrapInline(text, start, end, '*', 'italic');
    case 'inlineCode':
      return wrapInline(text, start, end, '`', 'code');
    case 'link':
      return wrapLink(text, start, end);
    case 'heading':
      return cycleHeading(text, start, end);
    case 'bulletList':
      return toggleList(text, start, end, 'bullet');
    case 'numberedList':
      return toggleList(text, start, end, 'numbered');
    case 'taskList':
      return toggleList(text, start, end, 'task');
  }
}

export function applyFormatToString(
  text: string,
  from: number,
  to: number,
  action: FormatAction,
): { text: string; from: number; to: number } {
  const patch = applyFormat(text, from, to, action);
  return {
    text: text.slice(0, patch.replaceFrom) + patch.insert + text.slice(patch.replaceTo),
    from: patch.selectionFrom,
    to: patch.selectionTo,
  };
}

export function insertSnippet(
  text: string,
  from: number,
  to: number,
  snippet: string,
): FormatPatch {
  const start = Math.max(0, Math.min(from, to, text.length));
  const end = Math.max(0, Math.min(Math.max(from, to), text.length));
  const caret = start + snippet.length;
  return {
    replaceFrom: start,
    replaceTo: end,
    insert: snippet,
    selectionFrom: caret,
    selectionTo: caret,
  };
}

function wrapInline(
  text: string,
  from: number,
  to: number,
  marker: string,
  placeholder: string,
): FormatPatch {
  const selected = text.slice(from, to);
  if (
    selected.length >= marker.length * 2 &&
    selected.startsWith(marker) &&
    selected.endsWith(marker)
  ) {
    const inner = selected.slice(marker.length, selected.length - marker.length);
    return {
      replaceFrom: from,
      replaceTo: to,
      insert: inner,
      selectionFrom: from,
      selectionTo: from + inner.length,
    };
  }
  const inner = selected.length > 0 ? selected : placeholder;
  const insert = `${marker}${inner}${marker}`;
  const innerFrom = from + marker.length;
  return {
    replaceFrom: from,
    replaceTo: to,
    insert,
    selectionFrom: innerFrom,
    selectionTo: innerFrom + inner.length,
  };
}

function wrapLink(text: string, from: number, to: number): FormatPatch {
  const selected = text.slice(from, to);
  if (selected.length > 0 && /^(https?:\/\/|mailto:)/i.test(selected)) {
    const insert = `[text](${selected})`;
    return {
      replaceFrom: from,
      replaceTo: to,
      insert,
      selectionFrom: from + 1,
      selectionTo: from + 5,
    };
  }
  const label = selected.length > 0 ? selected : 'text';
  const insert = `[${label}](url)`;
  const urlFrom = from + label.length + 3;
  return {
    replaceFrom: from,
    replaceTo: to,
    insert,
    selectionFrom: urlFrom,
    selectionTo: urlFrom + 3,
  };
}

function lineBounds(text: string, from: number, to: number): { start: number; end: number } {
  let start = from;
  while (start > 0 && text[start - 1] !== '\n') {
    start -= 1;
  }
  let end = to;
  while (end < text.length && text[end] !== '\n') {
    end += 1;
  }
  return { start, end };
}

function cycleHeading(text: string, from: number, to: number): FormatPatch {
  const { start, end } = lineBounds(text, from, from);
  void to;
  const line = text.slice(start, end);
  const matched = /^(#{1,6})([ \t]+)(.*)$/.exec(line);
  let next: string;
  if (!matched) {
    next = line.length ? `# ${line.replace(/^#+\s*/, '')}` : '# ';
  } else {
    const level = matched[1].length;
    const body = matched[3];
    if (level >= 3) {
      next = body;
    } else {
      next = `${'#'.repeat(level + 1)} ${body}`;
    }
  }
  return {
    replaceFrom: start,
    replaceTo: end,
    insert: next,
    selectionFrom: start,
    selectionTo: start + next.length,
  };
}

type ListKind = 'bullet' | 'numbered' | 'task';

function listPrefix(kind: ListKind, index: number): string {
  if (kind === 'bullet') {
    return '- ';
  }
  if (kind === 'numbered') {
    return `${index + 1}. `;
  }
  return '- [ ] ';
}

function stripListPrefix(line: string): string {
  return line.replace(/^(?:[-*+]|\d+\.)[ \t]+(?:\[[ xX]\][ \t]+)?/, '');
}

function hasListPrefix(line: string, kind: ListKind): boolean {
  if (kind === 'task') {
    return /^(?:[-*+]|\d+\.)[ \t]+\[[ xX]\][ \t]+/.test(line);
  }
  if (kind === 'numbered') {
    return /^\d+\.[ \t]+/.test(line) && !/^\d+\.[ \t]+\[[ xX]\]/.test(line);
  }
  return /^[-*+][ \t]+/.test(line) && !/^[-*+][ \t]+\[[ xX]\]/.test(line);
}

function toggleList(text: string, from: number, to: number, kind: ListKind): FormatPatch {
  const { start, end } = lineBounds(text, from, Math.max(to, from));
  const block = text.slice(start, end);
  const lines = block.split('\n');
  const allOn = lines.every((line) => line.trim() === '' || hasListPrefix(line, kind));
  const nextLines = lines.map((line, index) => {
    if (line.trim() === '') {
      return line;
    }
    const body = stripListPrefix(line);
    return allOn ? body : `${listPrefix(kind, index)}${body}`;
  });
  const insert = nextLines.join('\n');
  return {
    replaceFrom: start,
    replaceTo: end,
    insert,
    selectionFrom: start,
    selectionTo: start + insert.length,
  };
}
