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
 * ATX `#`–`######` plus cheap setext H1 / short-dash H2.
 * YAML frontmatter and thematic-break `---` are not headings.
 * Fenced code (backtick or tilde) is skipped so a `#` inside a fence is not a heading.
 */
export function parseOutlineHeadings(markdown: string): OutlineHeading[] {
  const headings: OutlineHeading[] = [];
  const lines = splitLines(markdown);
  let i = 0;
  let lineNumber = 1;

  if (lines[0] && isYamlFrontmatterFence(lines[0].text)) {
    i = 1;
    lineNumber = 2;
    while (i < lines.length) {
      const closer = isYamlFrontmatterFence(lines[i].text) || isYamlFrontmatterEnd(lines[i].text);
      i += 1;
      lineNumber += 1;
      if (closer) {
        break;
      }
    }
  }

  let fence: string | undefined;
  for (; i < lines.length; i++) {
    const { text, from } = lines[i];
    if (fence) {
      if (isFenceClose(text, fence)) {
        fence = undefined;
      }
      lineNumber += 1;
      continue;
    }

    const open = matchFenceOpen(text);
    if (open) {
      fence = open;
      lineNumber += 1;
      continue;
    }

    const atx = parseAtxHeadingLine(text);
    if (atx) {
      headings.push({
        level: atx.level,
        text: atx.text,
        from,
        line: lineNumber,
      });
      lineNumber += 1;
      continue;
    }

    const next = lines[i + 1];
    if (next && canBeSetextText(text)) {
      if (isSetextH1Underline(next.text)) {
        headings.push({ level: 1, text: text.trim(), from, line: lineNumber });
        lineNumber += 2;
        i += 1;
        continue;
      }
      if (isSetextH2Underline(next.text)) {
        headings.push({ level: 2, text: text.trim(), from, line: lineNumber });
        lineNumber += 2;
        i += 1;
        continue;
      }
    }

    lineNumber += 1;
  }

  return headings;
}

/** Opening/closing YAML fence used by Jekyll-style frontmatter. */
export function isYamlFrontmatterFence(line: string): boolean {
  return /^---\s*$/.test(line);
}

export function isYamlFrontmatterEnd(line: string): boolean {
  return /^\.\.\.\s*$/.test(line);
}

/** CommonMark thematic break — not a setext underline. */
export function isThematicBreak(line: string): boolean {
  return /^ {0,3}(?:(?:- *){3,}|(?:\* *){3,}|(?:_ *){3,})\s*$/.test(line);
}

export function isSetextH1Underline(line: string): boolean {
  return /^ {0,3}=+\s*$/.test(line);
}

/** One or two dashes only. Three or more is a thematic break (`---`). */
export function isSetextH2Underline(line: string): boolean {
  return /^ {0,3}-{1,2}\s*$/.test(line) && !isThematicBreak(line);
}

function canBeSetextText(text: string): boolean {
  return text.trim().length > 0 && !text.startsWith(' ') && !isThematicBreak(text);
}

/**
 * CommonMark-ish ATX: 0–3 leading spaces, 1–6 `#`, then whitespace (or EOL).
 * A closing `#` run counts only when a space/tab precedes it.
 */
export function parseAtxHeadingLine(line: string): { level: OutlineHeading['level']; text: string } | undefined {
  const match = /^( {0,3})(#{1,6})(.*)$/.exec(line);
  if (!match) {
    return undefined;
  }
  const rest = match[3];
  if (rest.length > 0 && rest[0] !== ' ' && rest[0] !== '\t') {
    return undefined;
  }
  let content = rest.replace(/^[ \t]+/, '').replace(/[ \t]+$/, '');
  const closed = /^(.*?)[ \t]+#+$/.exec(content);
  if (closed) {
    content = closed[1].replace(/[ \t]+$/, '');
  }
  return { level: match[2].length as OutlineHeading['level'], text: content };
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

/** Below this width the outline becomes an overlay drawer instead of a side rail. */
export const OUTLINE_COLLAPSE_MAX_PX = 640;

export function outlineAutoCollapsed(editorWidthPx: number): boolean {
  return editorWidthPx <= OUTLINE_COLLAPSE_MAX_PX;
}

/** Narrow shell: keep TOC as a drawer the user can reopen — never a dead toggle. */
export function outlineUsesOverlay(editorWidthPx: number): boolean {
  return outlineAutoCollapsed(editorWidthPx);
}

export function outlinePanelShouldRender(input: {
  enabled: boolean;
  open: boolean;
  editorWidthPx: number;
}): boolean {
  return input.enabled && input.open;
}
