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
    case 'strike':
      return wrapInline(text, start, end, '~~', 'strike');
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

function splitIndent(line: string): { indent: string; rest: string } {
  let i = 0;
  while (i < line.length && (line[i] === ' ' || line[i] === '\t')) {
    i += 1;
  }
  return { indent: line.slice(0, i), rest: line.slice(i) };
}

const ANY_LIST_MARKER = /^(?:[-*+]|\d+\.)[ \t]+(?:\[[ xX]\][ \t]+)?/;

function headingMarker(rest: string): { marker: string; body: string; level: number } | undefined {
  const matched = /^(#{1,6})([ \t]+)(.*)$/.exec(rest);
  if (!matched) {
    return undefined;
  }
  return { marker: matched[1] + matched[2], body: matched[3], level: matched[1].length };
}

function listMarkerOfKind(rest: string, kind: ListKind): string {
  if (kind === 'task') {
    return /^(?:[-*+]|\d+\.)[ \t]+\[[ xX]\][ \t]+/.exec(rest)?.[0] ?? '';
  }
  if (kind === 'numbered') {
    if (/^\d+\.[ \t]+\[[ xX]\]/.test(rest)) {
      return '';
    }
    return /^\d+\.[ \t]+/.exec(rest)?.[0] ?? '';
  }
  if (/^[-*+][ \t]+\[[ xX]\]/.test(rest)) {
    return '';
  }
  return /^[-*+][ \t]+/.exec(rest)?.[0] ?? '';
}

function anyListMarker(rest: string): string {
  return ANY_LIST_MARKER.exec(rest)?.[0] ?? '';
}

export function mapPosThroughPrefix(
  pos: number,
  oldFrom: number,
  oldTo: number,
  indentLen: number,
  oldMarkerLen: number,
  newMarkerLen: number,
  newFrom: number,
  newLen: number,
): number {
  if (pos < oldFrom) {
    return pos;
  }
  if (pos >= oldTo) {
    return newFrom + newLen + (pos - oldTo);
  }
  const offset = pos - oldFrom;
  if (offset < indentLen) {
    return newFrom + offset;
  }
  const oldPrefix = indentLen + oldMarkerLen;
  const newPrefix = indentLen + newMarkerLen;
  if (offset < oldPrefix) {
    return newFrom + newPrefix;
  }
  return Math.min(newFrom + newPrefix + (offset - oldPrefix), newFrom + newLen);
}

function cycleHeading(text: string, from: number, to: number): FormatPatch {
  const { start, end } = lineBounds(text, from, from);
  const line = text.slice(start, end);
  const { indent, rest } = splitIndent(line);
  const current = headingMarker(rest);
  const oldMarkerLen = current?.marker.length ?? 0;
  let newRest: string;
  if (!current) {
    const body = rest.replace(/^#+\s*/, '');
    newRest = body.length ? `# ${body}` : '# ';
  } else if (current.level >= 3) {
    newRest = current.body;
  } else {
    newRest = `${'#'.repeat(current.level + 1)} ${current.body}`;
  }
  const insert = indent + newRest;
  const newMarkerLen = headingMarker(newRest)?.marker.length ?? 0;
  return {
    replaceFrom: start,
    replaceTo: end,
    insert,
    selectionFrom: mapPosThroughPrefix(from, start, end, indent.length, oldMarkerLen, newMarkerLen, start, insert.length),
    selectionTo: mapPosThroughPrefix(to, start, end, indent.length, oldMarkerLen, newMarkerLen, start, insert.length),
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

function hasListPrefix(line: string, kind: ListKind): boolean {
  const { rest } = splitIndent(line);
  return listMarkerOfKind(rest, kind).length > 0;
}

function toggleList(text: string, from: number, to: number, kind: ListKind): FormatPatch {
  const { start, end } = lineBounds(text, from, Math.max(to, from));
  const block = text.slice(start, end);
  const lines = block.split('\n');
  const allOn = lines.every((line) => line.trim() === '' || hasListPrefix(line, kind));
  const specs = lines.map((line, index) => {
    if (line.trim() === '') {
      return { indentLen: 0, oldMarkerLen: 0, newMarkerLen: 0, newLine: line };
    }
    const { indent, rest } = splitIndent(line);
    const existing = anyListMarker(rest);
    const body = rest.slice(existing.length);
    const nextMarker = allOn ? '' : listPrefix(kind, index);
    return {
      indentLen: indent.length,
      oldMarkerLen: existing.length,
      newMarkerLen: nextMarker.length,
      newLine: indent + nextMarker + body,
    };
  });
  const insert = specs.map((spec) => spec.newLine).join('\n');
  return {
    replaceFrom: start,
    replaceTo: end,
    insert,
    selectionFrom: mapPosThroughList(from, start, lines, specs),
    selectionTo: mapPosThroughList(to, start, lines, specs),
  };
}

function mapPosThroughList(
  pos: number,
  replaceFrom: number,
  oldLines: readonly string[],
  specs: ReadonlyArray<{ indentLen: number; oldMarkerLen: number; newMarkerLen: number; newLine: string }>,
): number {
  let oldAt = replaceFrom;
  let newAt = replaceFrom;
  for (let i = 0; i < oldLines.length; i++) {
    const oldTo = oldAt + oldLines[i].length;
    const spec = specs[i];
    if (pos <= oldTo) {
      return mapPosThroughPrefix(
        pos,
        oldAt,
        oldTo,
        spec.indentLen,
        spec.oldMarkerLen,
        spec.newMarkerLen,
        newAt,
        spec.newLine.length,
      );
    }
    oldAt = oldTo + 1;
    newAt += spec.newLine.length + 1;
  }
  return newAt + (pos - oldAt);
}
