#!/usr/bin/env node
import * as esbuild from 'esbuild';
import { mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';

const require = createRequire(import.meta.url);
// mermaid's package root lazy-imports per-diagram chunks; those URLs 404
// under the webview CSP. Point at the prebundled ESM build so esbuild
// inlines it into a single webview.js (no CDN, no extra script tags).
const mermaidBundled = join(dirname(require.resolve('mermaid/package.json')), 'dist/mermaid.esm.min.mjs');

const production = process.argv.includes('--production');
const watch = process.argv.includes('--watch');

mkdirSync('dist', { recursive: true });

/** @type {import('esbuild').BuildOptions} */
const extensionOptions = {
  entryPoints: ['src/extension.ts'],
  bundle: true,
  outfile: 'dist/extension.js',
  external: ['vscode'],
  format: 'cjs',
  platform: 'node',
  sourcemap: !production,
  minify: production,
  logLevel: 'info',
  sourcesContent: false,
};

/** @type {import('esbuild').BuildOptions} */
const webviewOptions = {
  entryPoints: ['webview/index.tsx'],
  bundle: true,
  outfile: 'dist/webview.js',
  format: 'iife',
  platform: 'browser',
  sourcemap: !production,
  minify: production,
  logLevel: 'info',
  sourcesContent: false,
  jsx: 'automatic',
  alias: {
    mermaid: mermaidBundled,
  },
  // Statically include language grammars so webview dynamic import()
  // never 404s under the extension CSP.
  define: {
    'process.env.NODE_ENV': JSON.stringify(production ? 'production' : 'development'),
  },
};

async function main() {
  if (watch) {
    const extensionCtx = await esbuild.context(extensionOptions);
    const webviewCtx = await esbuild.context(webviewOptions);
    await Promise.all([extensionCtx.watch(), webviewCtx.watch()]);
    console.log('[watch] extension + webview');
    return;
  }

  await Promise.all([esbuild.build(extensionOptions), esbuild.build(webviewOptions)]);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
