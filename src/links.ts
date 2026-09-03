export type ClassifiedLink =
  | { kind: 'ignore' }
  | { kind: 'external'; href: string }
  | { kind: 'file'; path: string; fragment?: string };

const EXTERNAL_SCHEMES = new Set(['http', 'https', 'mailto']);

export function hrefScheme(href: string): string | undefined {
  const match = href.trim().match(/^([a-zA-Z][a-zA-Z0-9+.-]*):/);
  return match?.[1]?.toLowerCase();
}

/**
 * Classify a markdown link target without vscode types so the same
 * rules can be unit-tested. The extension host turns `file` results
 * into a Uri and opens them with `vscode.open`.
 *
 * Only http(s) and mailto are opened externally. Untrusted schemes
 * (`javascript:`, `command:`, `data:`, `vbscript:`, `vscode:`, …)
 * are ignored. `file:` and relative paths stay on the file path.
 */
export function classifyLink(href: string): ClassifiedLink {
  const trimmed = href.trim();
  if (!trimmed || trimmed.startsWith('#')) {
    return { kind: 'ignore' };
  }

  const scheme = hrefScheme(trimmed);
  if (scheme) {
    if (EXTERNAL_SCHEMES.has(scheme)) {
      return { kind: 'external', href: trimmed };
    }
    if (scheme === 'file') {
      const hash = trimmed.indexOf('#');
      const pathPart = hash === -1 ? trimmed : trimmed.slice(0, hash);
      const fragment = hash === -1 ? undefined : trimmed.slice(hash + 1);
      return { kind: 'file', path: pathPart, fragment };
    }
    return { kind: 'ignore' };
  }

  const hash = trimmed.indexOf('#');
  const pathPart = hash === -1 ? trimmed : trimmed.slice(0, hash);
  const fragment = hash === -1 ? undefined : trimmed.slice(hash + 1);
  return { kind: 'file', path: pathPart || trimmed, fragment };
}
