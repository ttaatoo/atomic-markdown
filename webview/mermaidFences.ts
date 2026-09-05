/** First info-string token is `mermaid` (case-insensitive). `mermaidjs` does not match. */
export function isMermaidLanguage(info: string | undefined | null): boolean {
  if (!info) {
    return false;
  }
  const first = info.trim().split(/\s+/)[0];
  return first.toLowerCase() === 'mermaid';
}

export type MermaidTheme = 'default' | 'dark';

export function mermaidThemeFromDataset(theme: string | undefined): MermaidTheme {
  return theme === 'light' ? 'default' : 'dark';
}

export function mermaidThemeFromDom(el: { dataset: { theme?: string } }): MermaidTheme {
  return mermaidThemeFromDataset(el.dataset.theme);
}

export function mermaidErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }
  if (typeof error === 'string' && error.trim()) {
    return error;
  }
  return 'Invalid mermaid diagram';
}

export interface LineDoc {
  readonly length: number;
  readonly lines: number;
  line(n: number): { from: number; to: number; text: string };
}

export interface MermaidFenceRange {
  from: number;
  to: number;
  info: string;
  body: string;
  marker: string;
}

export type MermaidWidgetKind = 'replace' | 'preview';

export interface MermaidWidgetPlan {
  fenceFrom: number;
  fenceTo: number;
  body: string;
  kind: MermaidWidgetKind;
}

/**
 * CommonMark-ish fence scan: 3+ backticks or tildes, optional 0–3 space indent,
 * matching closer of the same character (no info string). Incomplete fences
 * (no closer) are omitted so we never treat in-progress typing as a diagram.
 */
export function findMermaidFenceRanges(markdown: string): MermaidFenceRange[] {
  return findMermaidFenceRangesInDoc(lineDocFromString(markdown));
}

export function findMermaidFenceRangesInDoc(doc: LineDoc): MermaidFenceRange[] {
  const ranges: MermaidFenceRange[] = [];
  let i = 1;
  while (i <= doc.lines) {
    const openLine = doc.line(i);
    const open = matchOpenFence(openLine.text);
    if (!open || !isMermaidLanguage(open.info)) {
      i += 1;
      continue;
    }

    const body: string[] = [];
    let j = i + 1;
    let closed = false;
    let to = doc.length;
    while (j <= doc.lines) {
      const line = doc.line(j);
      if (isCloseFence(line.text, open.marker)) {
        closed = true;
        to = j < doc.lines ? line.to + 1 : line.to;
        break;
      }
      body.push(line.text);
      j += 1;
    }

    if (closed) {
      ranges.push({
        from: openLine.from,
        to,
        info: open.info.trim(),
        body: body.join('\n'),
        marker: open.marker,
      });
      i = j + 1;
      continue;
    }

    i += 1;
  }
  return ranges;
}

/** Parse a string that is itself a single mermaid fence (e.g. a lezer FencedCode slice). */
export function parseMermaidFence(fenceText: string): { info: string; body: string } | undefined {
  const match = findMermaidFenceRanges(fenceText).find((range) => range.from === 0);
  if (!match) {
    return undefined;
  }
  return { info: match.info, body: match.body };
}

export function selectionTouchesRange(
  ranges: ReadonlyArray<{ from: number; to: number }>,
  from: number,
  to: number,
): boolean {
  return ranges.some((range) => range.from <= to && range.to >= from);
}

export function planMermaidDecorations(
  markdown: string,
  options: { readOnly: boolean; ranges: ReadonlyArray<{ from: number; to: number }> },
): MermaidWidgetPlan[] {
  return planMermaidDecorationsFromFences(findMermaidFenceRanges(markdown), options);
}

export function planMermaidDecorationsFromFences(
  fences: readonly MermaidFenceRange[],
  options: { readOnly: boolean; ranges: ReadonlyArray<{ from: number; to: number }> },
): MermaidWidgetPlan[] {
  return fences.map((fence) => {
    const cursorInFence =
      !options.readOnly && selectionTouchesRange(options.ranges, fence.from, fence.to);
    return {
      fenceFrom: fence.from,
      fenceTo: fence.to,
      body: fence.body,
      kind: cursorInFence ? 'preview' : 'replace',
    };
  });
}

export function lineDocFromString(markdown: string): LineDoc {
  const lines: Array<{ from: number; to: number; text: string }> = [];
  if (markdown.length === 0) {
    lines.push({ from: 0, to: 0, text: '' });
  } else {
    let pos = 0;
    while (pos < markdown.length) {
      const nl = markdown.indexOf('\n', pos);
      if (nl === -1) {
        lines.push({ from: pos, to: markdown.length, text: stripCr(markdown.slice(pos)) });
        break;
      }
      lines.push({ from: pos, to: nl, text: stripCr(markdown.slice(pos, nl)) });
      pos = nl + 1;
    }
    if (markdown.endsWith('\n')) {
      lines.push({ from: markdown.length, to: markdown.length, text: '' });
    }
  }

  return {
    get length() {
      return markdown.length;
    },
    get lines() {
      return lines.length;
    },
    line(n: number) {
      const line = lines[n - 1];
      if (!line) {
        throw new Error(`line ${n} out of range`);
      }
      return line;
    },
  };
}

function stripCr(text: string): string {
  return text.endsWith('\r') ? text.slice(0, -1) : text;
}

function matchOpenFence(line: string): { marker: string; info: string } | undefined {
  const match = /^( {0,3})(`{3,}|~{3,})(.*)$/.exec(line);
  if (!match) {
    return undefined;
  }
  const marker = match[2];
  const info = match[3] ?? '';
  if (marker.startsWith('`') && info.includes('`')) {
    return undefined;
  }
  return { marker, info };
}

function isCloseFence(line: string, opener: string): boolean {
  const ch = opener[0];
  const indent = /^( {0,3})/.exec(line)?.[1].length ?? 0;
  const rest = line.slice(indent);
  if (!rest.startsWith(ch.repeat(opener.length))) {
    return false;
  }
  let i = opener.length;
  while (rest[i] === ch) {
    i += 1;
  }
  return rest.slice(i).trim() === '';
}
