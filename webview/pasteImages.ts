const ALLOWED_IMAGE_MIME = new Set([
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/gif',
  'image/webp',
  'image/svg+xml',
]);

const EXT_TO_MIME: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  svg: 'image/svg+xml',
};

const MAX_BYTES = 8 * 1024 * 1024;

export function inferImageMime(mime: string, filename = ''): string | undefined {
  const trimmed = mime.trim().toLowerCase();
  if (ALLOWED_IMAGE_MIME.has(trimmed)) {
    return trimmed === 'image/jpg' ? 'image/jpeg' : trimmed;
  }
  const ext = filename.replace(/^.*\./, '').toLowerCase();
  return EXT_TO_MIME[ext];
}

export function canSaveClipboardImage(input: { mime: string; filename?: string; size: number }): {
  ok: true;
  mime: string;
} | { ok: false; reason: string } {
  const mime = inferImageMime(input.mime, input.filename ?? '');
  if (!mime) {
    return { ok: false, reason: 'Not a supported image type' };
  }
  if (input.size > MAX_BYTES) {
    return { ok: false, reason: 'Image is too large (max 8 MB)' };
  }
  return { ok: true, mime };
}

export function dataUrlToBase64(dataUrl: string): string {
  const comma = dataUrl.indexOf(',');
  return comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl;
}

let requestSeq = 0;

export function nextImageRequestId(): string {
  requestSeq += 1;
  return `img-${Date.now()}-${requestSeq}`;
}

export function fileToBase64(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result !== 'string') {
        reject(new Error('Could not read image'));
        return;
      }
      resolve(dataUrlToBase64(result));
    };
    reader.onerror = () => reject(reader.error ?? new Error('Could not read image'));
    reader.readAsDataURL(file);
  });
}

export function imageFilesFromDataTransfer(dt: DataTransfer | null | undefined): File[] {
  if (!dt) {
    return [];
  }
  const found: File[] = [];
  const seen = new Set<File>();
  if (dt.items) {
    for (const item of Array.from(dt.items)) {
      if (item.kind !== 'file') {
        continue;
      }
      const file = item.getAsFile();
      if (file && inferImageMime(file.type, file.name) && !seen.has(file)) {
        seen.add(file);
        found.push(file);
      }
    }
  }
  if (found.length === 0 && dt.files) {
    for (const file of Array.from(dt.files)) {
      if (inferImageMime(file.type, file.name) && !seen.has(file)) {
        seen.add(file);
        found.push(file);
      }
    }
  }
  return found;
}
