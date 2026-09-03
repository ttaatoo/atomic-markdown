export type DocumentEol = '\n' | '\r\n';

/** Collapse CR LF / CR to LF so the webview editor sees a single convention. */
export function toLineFeed(text: string): string {
  return text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
}

/** Re-apply the TextDocument's EOL so a round-trip does not rewrite endings. */
export function toDocumentEol(text: string, eol: DocumentEol): string {
  const lf = toLineFeed(text);
  return eol === '\n' ? lf : lf.replace(/\n/g, '\r\n');
}

export function sameMarkdown(a: string, b: string): boolean {
  return toLineFeed(a) === toLineFeed(b);
}
