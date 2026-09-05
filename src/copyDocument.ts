export const DOCUMENT_COPY_FAILED = "Couldn't copy the document.";
export const DOCUMENT_COPIED_FEEDBACK_MS = 2000;

/**
 * Full-document copy always uses the host TextDocument body.
 * The webview must not supply the clipboard payload.
 */
export function planCopyDocument(input: { documentText: string }): { text: string } {
  return { text: input.documentText };
}

export async function writeDocumentCopy(
  documentText: string,
  writeClipboard: (text: string) => PromiseLike<void>,
): Promise<{ ok: true } | { ok: false; message: string }> {
  try {
    await writeClipboard(documentText);
    return { ok: true };
  } catch {
    return { ok: false, message: DOCUMENT_COPY_FAILED };
  }
}
