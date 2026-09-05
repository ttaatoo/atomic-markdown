import mermaid from 'mermaid';
import {
  mermaidErrorMessage,
  type MermaidTheme,
} from './mermaidFences';

export type MermaidRenderResult = { ok: true; svg: string } | { ok: false; error: string };

/**
 * mermaid's package root (`mermaid.core.mjs`) lazy-imports per-diagram chunks.
 * esbuild aliases `mermaid` to `dist/mermaid.esm.min.mjs` so those imports are
 * inlined into webview.js — no extra script URLs, no CDN, CSP `script-src`
 * stays nonce + `webview.cspSource`.
 */
let renderChain: Promise<unknown> = Promise.resolve();
let initializedTheme: MermaidTheme | undefined;
let renderSeq = 0;

const resultCache = new Map<string, MermaidRenderResult>();

export function mermaidCacheKey(source: string, theme: MermaidTheme): string {
  return `${theme}\0${source}`;
}

export function cachedMermaidResult(source: string, theme: MermaidTheme): MermaidRenderResult | undefined {
  return resultCache.get(mermaidCacheKey(source, theme));
}

export function renderMermaidSvg(source: string, theme: MermaidTheme): Promise<MermaidRenderResult> {
  const trimmed = source.trim();
  if (!trimmed) {
    return Promise.resolve({ ok: false, error: 'Empty mermaid diagram' });
  }

  const key = mermaidCacheKey(source, theme);
  const cached = resultCache.get(key);
  if (cached) {
    return Promise.resolve(cached);
  }

  const result = enqueue(async () => {
    const again = resultCache.get(key);
    if (again) {
      return again;
    }
    try {
      ensureInitialized(theme);
      const id = `atomicMermaid${++renderSeq}`;
      const { svg } = await mermaid.render(id, source);
      if (!svg.trim()) {
        const empty: MermaidRenderResult = { ok: false, error: 'Mermaid produced an empty diagram' };
        resultCache.set(key, empty);
        return empty;
      }
      const ok: MermaidRenderResult = { ok: true, svg };
      resultCache.set(key, ok);
      return ok;
    } catch (error) {
      const failed: MermaidRenderResult = { ok: false, error: mermaidErrorMessage(error) };
      resultCache.set(key, failed);
      return failed;
    }
  });

  return result;
}

function enqueue<T>(work: () => Promise<T>): Promise<T> {
  const next = renderChain.then(work, work);
  renderChain = next.then(
    () => undefined,
    () => undefined,
  );
  return next;
}

function ensureInitialized(theme: MermaidTheme): void {
  if (initializedTheme === theme) {
    return;
  }
  const fontFamily = workbenchFontFamily();
  mermaid.initialize({
    startOnLoad: false,
    securityLevel: 'strict',
    theme,
    fontFamily,
    themeVariables: fontFamily ? { fontFamily } : undefined,
  });
  initializedTheme = theme;
}

function workbenchFontFamily(): string | undefined {
  if (typeof getComputedStyle !== 'function' || typeof document === 'undefined') {
    return undefined;
  }
  const style = getComputedStyle(document.documentElement);
  const mono = style.getPropertyValue('--atomic-editor-font-mono').trim();
  const fontMono = style.getPropertyValue('--font-mono').trim();
  const editor = style.getPropertyValue('--vscode-editor-font-family').trim();
  const ui = style.getPropertyValue('--vscode-font-family').trim();
  return mono || fontMono || editor || ui || undefined;
}
