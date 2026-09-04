import { mermaidErrorMessage } from './mermaidFences.ts';

export { mermaidErrorMessage };

/**
 * Keep mermaid failures inside the diagram widget.
 * An uncaught render/layout error must never unmount React/Atomic (gray blank).
 */
export function mermaidErrorBoundary<T>(fn: () => T, fallback: (err: unknown) => T): T {
  try {
    return fn();
  } catch (err) {
    return fallback(err);
  }
}

export async function safeMermaidRender(
  render: () => Promise<void>,
): Promise<{ ok: true } | { ok: false; message: string }> {
  try {
    await render();
    return { ok: true };
  } catch (err) {
    return { ok: false, message: mermaidErrorMessage(err) };
  }
}

let installed = false;

/** Catch leftover mermaid/widget errors so they cannot tear down the webview. */
export function installMermaidErrorIsolation(): void {
  if (installed || typeof window === 'undefined') {
    return;
  }
  installed = true;
  window.addEventListener('error', (event) => {
    const msg = String(event.message ?? '');
    const src = String(event.filename ?? '');
    if (/mermaid/i.test(msg) || /mermaid/i.test(src)) {
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  });
  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason;
    const msg = reason instanceof Error ? reason.message : String(reason ?? '');
    if (/mermaid/i.test(msg)) {
      event.preventDefault();
    }
  });
}
