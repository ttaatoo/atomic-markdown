export interface ImageResolveOptions {
  documentDirWebviewUri?: string;
  workspaceWebviewUri?: string;
}

const ALLOWED_MEDIA_SCHEMES = new Set(['http', 'https', 'vscode-webview', 'vscode-file']);

export function mediaScheme(src: string): string | undefined {
  const match = src.trim().match(/^([a-zA-Z][a-zA-Z0-9+.-]*):/);
  return match?.[1]?.toLowerCase();
}

export function isAllowedMediaUrl(src: string): boolean {
  const scheme = mediaScheme(src);
  return scheme !== undefined && ALLOWED_MEDIA_SCHEMES.has(scheme);
}

export function hasRejectedMediaScheme(src: string): boolean {
  const scheme = mediaScheme(src);
  return scheme !== undefined && !ALLOWED_MEDIA_SCHEMES.has(scheme);
}

/**
 * Rewrite a markdown image src so the webview can load it.
 * Allowlisted absolute URIs pass through; relative paths join the
 * document directory's asWebviewUri; leading "/" is workspace-root.
 *
 * SVG files are displayed with <img src> after this rewrite. That is
 * untrusted image data (no script execution). Do not inline SVG markup.
 */
export function resolveImageSrc(src: string, options: ImageResolveOptions): string | undefined {
  const trimmed = src.trim();
  if (!trimmed) {
    return trimmed;
  }
  if (isAllowedMediaUrl(trimmed)) {
    return trimmed;
  }
  if (hasRejectedMediaScheme(trimmed)) {
    return undefined;
  }

  try {
    if (trimmed.startsWith('/') && options.workspaceWebviewUri) {
      return joinWebviewUri(options.workspaceWebviewUri, trimmed.replace(/^\/+/, ''));
    }
    if (options.documentDirWebviewUri) {
      return joinWebviewUri(options.documentDirWebviewUri, trimmed);
    }
  } catch {
    return trimmed;
  }

  return trimmed;
}

export function joinWebviewUri(base: string, relative: string): string {
  const normalizedBase = base.endsWith('/') ? base : `${base}/`;
  const rel = relative.replace(/\\/g, '/').replace(/^\.\//, '');
  if (mediaScheme(rel) || hasRejectedMediaScheme(rel)) {
    throw new Error('refusing to join an absolute or rejected URL as a relative image path');
  }
  return new URL(rel, normalizedBase).toString();
}

export function rewriteImageElement(img: HTMLImageElement, options: ImageResolveOptions): void {
  const original = img.dataset.originalSrc ?? img.getAttribute('src') ?? '';
  if (!original) {
    return;
  }
  if (isAllowedMediaUrl(original) && !img.dataset.originalSrc) {
    return;
  }

  const next = resolveImageSrc(original, options);
  if (next === undefined) {
    if (hasRejectedMediaScheme(original)) {
      img.removeAttribute('src');
      img.dataset.originalSrc = original;
    }
    return;
  }

  if (next === original && !hasRejectedMediaScheme(original)) {
    return;
  }

  img.dataset.originalSrc = original;
  if (img.getAttribute('src') !== next) {
    img.setAttribute('src', next);
  }
}

export function rewriteImagesIn(root: ParentNode, options: ImageResolveOptions): void {
  for (const img of root.querySelectorAll('img')) {
    try {
      rewriteImageElement(img, options);
    } catch {
      // One bad src must not abort the MutationObserver for other images.
    }
  }
}
