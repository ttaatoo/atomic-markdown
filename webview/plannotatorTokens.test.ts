import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const css = readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'theme.css'), 'utf8');

describe('Plannotator tokens in theme.css', () => {
  it('copies the default dark palette values verbatim', () => {
    assert.match(css, /html\.theme-plannotator \{/);
    assert.match(css, /--background: oklch\(0\.15 0\.02 260\);/);
    assert.match(css, /--foreground: oklch\(0\.90 0\.01 260\);/);
    assert.match(css, /--card: oklch\(0\.22 0\.02 260\);/);
    assert.match(css, /--primary: oklch\(0\.75 0\.18 280\);/);
    assert.match(css, /--muted-foreground: oklch\(0\.72 0\.02 260\);/);
    assert.match(css, /--accent: oklch\(0\.70 0\.20 60\);/);
    assert.match(css, /--border: oklch\(0\.35 0\.02 260\);/);
    assert.match(css, /--ring: oklch\(0\.75 0\.18 280\);/);
    assert.match(css, /--code-bg: oklch\(0\.26 0\.02 260\);/);
    assert.match(css, /--font-sans: 'Inter Variable', 'Inter', system-ui, sans-serif;/);
    assert.match(
      css,
      /--font-mono: 'Geist Mono Variable', 'Geist Mono', 'JetBrains Mono', 'Fira Code', ui-monospace, monospace;/,
    );
  });

  it('copies the default light palette values verbatim', () => {
    assert.match(css, /html\.theme-plannotator\.light \{/);
    assert.match(css, /--background: oklch\(0\.97 0\.005 260\);/);
    assert.match(css, /--foreground: oklch\(0\.18 0\.02 260\);/);
    assert.match(css, /--card: oklch\(1 0 0\);/);
    assert.match(css, /--primary: oklch\(0\.50 0\.25 280\);/);
    assert.match(css, /--muted: oklch\(0\.92 0\.01 260\);/);
    assert.match(css, /--muted-foreground: oklch\(0\.40 0\.02 260\);/);
    assert.match(css, /--accent: oklch\(0\.60 0\.22 50\);/);
    assert.match(css, /--border: oklch\(0\.88 0\.01 260\);/);
    assert.match(css, /--ring: oklch\(0\.50 0\.25 280\);/);
    assert.match(css, /--code-bg: oklch\(0\.92 0\.01 260\);/);
  });

  it('maps the writing surface onto Atomic tokens from the palette, not vscode editor colors', () => {
    const mappingStart = css.indexOf('html.theme-plannotator .atomic-cm-editor');
    const mapping = css.slice(mappingStart, css.indexOf('.cm-atomic-mermaid'));
    assert.match(mapping, /--atomic-editor-bg: var\(--background\);/);
    assert.match(mapping, /--atomic-editor-fg: var\(--foreground\);/);
    assert.match(mapping, /--atomic-editor-link: var\(--primary\);/);
    assert.match(mapping, /--atomic-editor-code-bg: var\(--code-bg\);/);
    assert.equal(mapping.includes('--vscode-editor-'), false);
  });
});
