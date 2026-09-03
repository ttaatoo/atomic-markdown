export interface ImageResolveOptions {
  documentDirWebviewUri?: string;
  workspaceWebviewUri?: string;
}

export function isAbsoluteMediaUrl(src: string): boolean {
  return /^(https?:|data:|vscode-webview:|vscode-file:)/i.test(src);
}

/**
 * Rewrite a markdown image src so the webview can load it.
 * http(s)/data/webview URIs pass through; relative paths join the
 * document directory's asWebviewUri; leading "/" is workspace-root.
 */
export function resolveImageSrc(src: string, options: ImageResolveOptions): string {
  const trimmed = src.trim();
  if (!trimmed || isAbsoluteMediaUrl(trimmed)) {
    return trimmed;
  }

  if (trimmed.startsWith('file:')) {
    return trimmed;
  }

  if (trimmed.startsWith('/') && options.workspaceWebviewUri) {
    return joinWebviewUri(options.workspaceWebviewUri, trimmed.replace(/^\/+/, ''));
  }

  if (options.documentDirWebviewUri) {
    return joinWebviewUri(options.documentDirWebviewUri, trimmed);
  }

  return trimmed;
}

export function joinWebviewUri(base: string, relative: string): string {
  const normalizedBase = base.endsWith('/') ? base : `${base}/`;
  const rel = relative.replace(/\\/g, '/').replace(/^\.\//, '');
  return new URL(rel, normalizedBase).toString();
}

export function rewriteImageElement(img: HTMLImageElement, options: ImageResolveOptions): void {
  const original = img.dataset.originalSrc ?? img.getAttribute('src') ?? '';
  if (!original || isAbsoluteMediaUrl(original)) {
    return;
  }

  const next = resolveImageSrc(original, options);
  if (next === original) {
    return;
  }

  img.dataset.originalSrc = original;
  if (img.getAttribute('src') !== next) {
    img.setAttribute('src', next);
  }
}

export function rewriteImagesIn(root: ParentNode, options: ImageResolveOptions): void {
  for (const img of root.querySelectorAll('img')) {
    rewriteImageElement(img, options);
  }
}
