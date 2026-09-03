const DEFAULT_IMAGE_DIRECTORY = 'assets';

const MIME_EXTENSION: Record<string, string> = {
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'image/jpg': '.jpg',
  'image/gif': '.gif',
  'image/webp': '.webp',
  'image/svg+xml': '.svg',
};

export const IMAGE_SAVE_MAX_BYTES = 8 * 1024 * 1024;

export function extensionForMime(mime: string): string | undefined {
  return MIME_EXTENSION[mime.trim().toLowerCase()];
}

export function isAllowedImageMime(mime: string): boolean {
  return extensionForMime(mime) !== undefined;
}

/**
 * Relative directory under the markdown file. Rejects absolute paths,
 * drive letters, and `..` / `.` segments so we never write outside the
 * document directory.
 */
export function parseImageDirectory(value: unknown): { ok: true; directory: string } | { ok: false; reason: string } {
  if (value === undefined || value === null || value === '') {
    return { ok: true, directory: DEFAULT_IMAGE_DIRECTORY };
  }
  if (typeof value !== 'string') {
    return { ok: false, reason: 'atomicMarkdown.images.directory must be a string' };
  }
  const trimmed = value.trim().replace(/\\/g, '/');
  if (!trimmed) {
    return { ok: true, directory: DEFAULT_IMAGE_DIRECTORY };
  }
  if (trimmed.startsWith('/') || /^[a-zA-Z]:/.test(trimmed) || trimmed.includes(':')) {
    return { ok: false, reason: 'Image directory must be relative to the Markdown file' };
  }
  const parts = trimmed.split('/').filter((part) => part.length > 0);
  if (parts.length === 0) {
    return { ok: true, directory: DEFAULT_IMAGE_DIRECTORY };
  }
  if (parts.some((part) => part === '.' || part === '..')) {
    return { ok: false, reason: 'Image directory cannot contain "." or ".." segments' };
  }
  return { ok: true, directory: parts.join('/') };
}

export function sanitizeImageBasename(name: string): string {
  const leaf = name.replace(/\\/g, '/').split('/').pop() ?? '';
  const stripped = leaf.replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^\.+/, '').replace(/\.+$/, '');
  const cut = stripped.slice(0, 80);
  return cut || 'image';
}

export function ensureExtension(basename: string, mime: string): string {
  const ext = extensionForMime(mime) ?? '.png';
  const lower = basename.toLowerCase();
  if (lower.endsWith('.png') || lower.endsWith('.jpg') || lower.endsWith('.jpeg') || lower.endsWith('.gif') || lower.endsWith('.webp') || lower.endsWith('.svg')) {
    if (lower.endsWith('.jpeg')) {
      return `${basename.slice(0, -5)}${ext}`;
    }
    const current = basename.slice(basename.lastIndexOf('.'));
    if (current.toLowerCase() === ext) {
      return basename;
    }
    return `${basename.slice(0, basename.lastIndexOf('.'))}${ext}`;
  }
  return `${basename}${ext}`;
}

export function uniqueFilename(existingLower: Iterable<string>, desired: string): string {
  const taken = existingLower instanceof Set ? existingLower : new Set(
    [...existingLower].map((name) => name.toLowerCase()),
  );
  if (!taken.has(desired.toLowerCase())) {
    return desired;
  }
  const dot = desired.lastIndexOf('.');
  const stem = dot === -1 ? desired : desired.slice(0, dot);
  const ext = dot === -1 ? '' : desired.slice(dot);
  let n = 2;
  let candidate = `${stem}-${n}${ext}`;
  while (taken.has(candidate.toLowerCase())) {
    n += 1;
    candidate = `${stem}-${n}${ext}`;
  }
  return candidate;
}

export function timestampBasename(now: Date): string {
  const pad = (value: number) => String(value).padStart(2, '0');
  return `paste-${now.getUTCFullYear()}${pad(now.getUTCMonth() + 1)}${pad(now.getUTCDate())}-${pad(now.getUTCHours())}${pad(now.getUTCMinutes())}${pad(now.getUTCSeconds())}`;
}

export function relativeMarkdownImagePath(directory: string, filename: string): string {
  return `./${directory}/${filename}`.replace(/\/{2,}/g, '/');
}

export function markdownImageSnippet(alt: string, relativePath: string): string {
  const safeAlt = alt.replace(/[[\]]/g, '').trim() || 'image';
  return `![${safeAlt}](${relativePath})`;
}

export function untitledImageError(): string {
  return 'Save the Markdown file first to paste or drop images. Clipboard contents were not changed.';
}

export function altFromBasename(filename: string): string {
  return filename.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ').trim() || 'image';
}

export function planSavedImagePath(input: {
  directorySetting: unknown;
  mime: string;
  basename: string | undefined;
  existingNames: Iterable<string>;
  now: Date;
}):
  | { ok: true; directory: string; filename: string; relativePath: string; snippet: string }
  | { ok: false; reason: string } {
  if (!isAllowedImageMime(input.mime)) {
    return { ok: false, reason: `Unsupported image type: ${input.mime || 'unknown'}` };
  }
  const directory = parseImageDirectory(input.directorySetting);
  if (!directory.ok) {
    return directory;
  }
  const desired = ensureExtension(
    sanitizeImageBasename(input.basename ?? timestampBasename(input.now)),
    input.mime,
  );
  const filename = uniqueFilename(input.existingNames, desired);
  const relativePath = relativeMarkdownImagePath(directory.directory, filename);
  return {
    ok: true,
    directory: directory.directory,
    filename,
    relativePath,
    snippet: markdownImageSnippet(altFromBasename(filename), relativePath),
  };
}

export function decodeBase64Bytes(base64: string): Uint8Array {
  return Uint8Array.from(Buffer.from(base64, 'base64'));
}
