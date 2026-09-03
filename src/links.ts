export type ClassifiedLink =
  | { kind: 'ignore' }
  | { kind: 'external'; href: string }
  | { kind: 'file'; path: string; fragment?: string };

/**
 * Classify a markdown link target without vscode types so the same
 * rules can be unit-tested. The extension host turns `file` results
 * into a Uri and opens them with `vscode.open`.
 */
export function classifyLink(href: string): ClassifiedLink {
  const trimmed = href.trim();
  if (!trimmed || trimmed.startsWith('#')) {
    return { kind: 'ignore' };
  }

  if (/^(https?:|mailto:|vscode:)/i.test(trimmed)) {
    return { kind: 'external', href: trimmed };
  }

  const hash = trimmed.indexOf('#');
  const pathPart = hash === -1 ? trimmed : trimmed.slice(0, hash);
  const fragment = hash === -1 ? undefined : trimmed.slice(hash + 1);

  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(pathPart) && !pathPart.startsWith('file:')) {
    return { kind: 'external', href: trimmed };
  }

  return { kind: 'file', path: pathPart || trimmed, fragment };
}
