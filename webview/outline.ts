export interface OutlineHeading {
  level: 1 | 2 | 3 | 4 | 5 | 6;
  text: string;
  from: number;
  line: number;
}

export interface OutlineNode extends OutlineHeading {
  children: OutlineNode[];
}

/**
 * ATX `#`–`######` plus cheap setext H1/H2. Fenced code (backtick or tilde)
 * is skipped so a `#` inside a fence is not a heading.
 */
export function parseOutlineHeadings(markdown: string): OutlineHeading[] {
  const headings: OutlineHeading[] = [];
  let offset = 0;
  let lineNumber = 1;
  let fence: string | undefined;
  const lines = splitLines(markdown);

  for (let i = 0; i < lines.length; i++) {
    const { text, from, to } = lines[i];
    void to;
    if (fence) {
      if (isFenceClose(text, fence)) {
        fence = undefined;
      }
      offset = i + 1 < lines.length ? lines[i + 1].from : markdown.length;
      lineNumber += 1;
      continue;
    }

    const open = matchFenceOpen(text);
    if (open) {
      fence = open;
      lineNumber += 1;
      continue;
    }

    const atx = /^(#{1,6})[ \t]+(.+?)\s*#*\s*$/.exec(text);
    if (atx) {
      headings.push({
        level: atx[1].length as OutlineHeading['level'],
        text: atx[2].trim(),
        from,
        line: lineNumber,
      });
      lineNumber += 1;
      continue;
    }

    const next = lines[i + 1];
    if (next && text.trim().length > 0 && !text.startsWith(' ')) {
      if (/^=+\s*$/.test(next.text)) {
        headings.push({ level: 1, text: text.trim(), from, line: lineNumber });
        lineNumber += 1;
        i += 1;
        lineNumber += 1;
        continue;
      }
      if (/^-{3,}\s*$/.test(next.text)) {
        headings.push({ level: 2, text: text.trim(), from, line: lineNumber });
        lineNumber += 1;
        i += 1;
        lineNumber += 1;
        continue;
      }
    }

    lineNumber += 1;
    offset = from;
    void offset;
  }

  return headings;
}

export function nestOutline(headings: readonly OutlineHeading[]): OutlineNode[] {
  const root: OutlineNode[] = [];
  const stack: OutlineNode[] = [];
  for (const heading of headings) {
    const node: OutlineNode = { ...heading, children: [] };
    while (stack.length > 0 && stack[stack.length - 1].level >= node.level) {
      stack.pop();
    }
    if (stack.length === 0) {
      root.push(node);
    } else {
      stack[stack.length - 1].children.push(node);
    }
    stack.push(node);
  }
  return root;
}

function splitLines(markdown: string): Array<{ text: string; from: number; to: number }> {
  const lines: Array<{ text: string; from: number; to: number }> = [];
  let pos = 0;
  if (markdown.length === 0) {
    return [{ text: '', from: 0, to: 0 }];
  }
  while (pos < markdown.length) {
    const nl = markdown.indexOf('\n', pos);
    if (nl === -1) {
      lines.push({ text: stripCr(markdown.slice(pos)), from: pos, to: markdown.length });
      break;
    }
    lines.push({ text: stripCr(markdown.slice(pos, nl)), from: pos, to: nl });
    pos = nl + 1;
  }
  return lines;
}

function stripCr(text: string): string {
  return text.endsWith('\r') ? text.slice(0, -1) : text;
}

function matchFenceOpen(line: string): string | undefined {
  const match = /^( {0,3})(`{3,}|~{3,})(.*)$/.exec(line);
  if (!match) {
    return undefined;
  }
  const marker = match[2];
  if (marker.startsWith('`') && match[3].includes('`')) {
    return undefined;
  }
  return marker;
}

function isFenceClose(line: string, opener: string): boolean {
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

export function outlineTreeFromMarkdown(markdown: string): OutlineNode[] {
  return nestOutline(parseOutlineHeadings(markdown));
}

/** Longer pause on big documents so typing is not blocked by outline rebuilds. */
export function outlineDebounceMs(docLength: number): number {
  return docLength > 200_000 ? 200 : 80;
}

export function defaultOutlineOpen(enabled: boolean, wideEditor: boolean): boolean {
  return enabled && wideEditor;
}
