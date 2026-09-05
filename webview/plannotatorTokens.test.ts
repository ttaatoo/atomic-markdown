import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const css = readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'theme.css'), 'utf8');

/** Exact color / radius tokens from plannotator.css `.theme-plannotator`. */
const DARK_TOKENS: Record<string, string> = {
  '--background': 'oklch(0.15 0.02 260)',
  '--foreground': 'oklch(0.90 0.01 260)',
  '--card': 'oklch(0.22 0.02 260)',
  '--card-foreground': 'oklch(0.90 0.01 260)',
  '--popover': 'oklch(0.28 0.025 260)',
  '--popover-foreground': 'oklch(0.90 0.01 260)',
  '--primary': 'oklch(0.75 0.18 280)',
  '--primary-foreground': 'oklch(0.15 0.02 260)',
  '--secondary': 'oklch(0.65 0.15 180)',
  '--secondary-foreground': 'oklch(0.15 0.02 260)',
  '--muted': 'oklch(0.26 0.02 260)',
  '--muted-foreground': 'oklch(0.72 0.02 260)',
  '--accent': 'oklch(0.70 0.20 60)',
  '--accent-foreground': 'oklch(0.15 0.02 260)',
  '--destructive': 'oklch(0.65 0.20 25)',
  '--destructive-foreground': 'oklch(0.98 0 0)',
  '--border': 'oklch(0.35 0.02 260)',
  '--input': 'oklch(0.26 0.02 260)',
  '--ring': 'oklch(0.75 0.18 280)',
  '--success': 'oklch(0.72 0.17 150)',
  '--success-foreground': 'oklch(0.15 0.02 260)',
  '--warning': 'oklch(0.75 0.15 85)',
  '--warning-foreground': 'oklch(0.20 0.02 260)',
  '--radius': '0.625rem',
  '--code-bg': 'oklch(0.26 0.02 260)',
  '--focus-highlight': 'oklch(0.70 0.20 200)',
};

/** Exact color tokens from plannotator.css `.theme-plannotator.light`. */
const LIGHT_TOKENS: Record<string, string> = {
  '--background': 'oklch(0.97 0.005 260)',
  '--foreground': 'oklch(0.18 0.02 260)',
  '--card': 'oklch(1 0 0)',
  '--card-foreground': 'oklch(0.18 0.02 260)',
  '--popover': 'oklch(1 0 0)',
  '--popover-foreground': 'oklch(0.18 0.02 260)',
  '--primary': 'oklch(0.50 0.25 280)',
  '--primary-foreground': 'oklch(1 0 0)',
  '--secondary': 'oklch(0.50 0.18 180)',
  '--secondary-foreground': 'oklch(1 0 0)',
  '--muted': 'oklch(0.92 0.01 260)',
  '--muted-foreground': 'oklch(0.40 0.02 260)',
  '--accent': 'oklch(0.60 0.22 50)',
  '--accent-foreground': 'oklch(0.18 0.02 260)',
  '--destructive': 'oklch(0.50 0.25 25)',
  '--destructive-foreground': 'oklch(1 0 0)',
  '--border': 'oklch(0.88 0.01 260)',
  '--input': 'oklch(0.92 0.01 260)',
  '--ring': 'oklch(0.50 0.25 280)',
  '--success': 'oklch(0.45 0.20 150)',
  '--success-foreground': 'oklch(1 0 0)',
  '--warning': 'oklch(0.55 0.18 85)',
  '--warning-foreground': 'oklch(0.18 0.02 260)',
  '--code-bg': 'oklch(0.92 0.01 260)',
};

function firstRuleBlock(source: string, selector: string): string {
  const start = source.indexOf(selector);
  assert.ok(start >= 0, `missing ${selector}`);
  const open = source.indexOf('{', start);
  const close = source.indexOf('}', open);
  return source.slice(open + 1, close);
}

function assertTokens(block: string, tokens: Record<string, string>): void {
  for (const [name, value] of Object.entries(tokens)) {
    const expected = `${name}: ${value};`;
    assert.equal(block.includes(expected), true, `missing exact ${expected}`);
    const assignments = block.match(new RegExp(`${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}:`, 'g')) ?? [];
    assert.equal(assignments.length, 1, `${name} must be assigned once in the palette block`);
  }
}

describe('Plannotator tokens in theme.css', () => {
  it('copies the default dark palette values verbatim', () => {
    assert.match(css, /html\.theme-plannotator \{/);
    const dark = firstRuleBlock(css, 'html.theme-plannotator {');
    assertTokens(dark, DARK_TOKENS);
    assert.match(dark, /--font-sans: var\(--vscode-font-family\), system-ui, sans-serif;/);
    assert.match(dark, /--font-mono: var\(--vscode-editor-font-family\), ui-monospace, monospace;/);
  });

  it('copies the default light palette values verbatim', () => {
    assert.match(css, /html\.theme-plannotator\.light \{/);
    const light = firstRuleBlock(css, 'html.theme-plannotator.light {');
    assertTokens(light, LIGHT_TOKENS);
  });

  it('does not quiet, desaturate, or follow-workbench-remap the palettes', () => {
    assert.equal(css.includes('theme-follow'), false);
    assert.equal(css.includes('--primary: oklch(0.72 0.08 280)'), false);
    const primaries = [...css.matchAll(/--primary:\s*([^;]+);/g)].map((m) => m[1].trim());
    assert.deepEqual(primaries, ['oklch(0.75 0.18 280)', 'oklch(0.50 0.25 280)']);
  });

  it('maps the writing surface onto Atomic tokens from the palette, not vscode editor colors', () => {
    const mappingStart = css.indexOf('html.theme-plannotator .atomic-cm-editor');
    const mapping = css.slice(mappingStart, css.indexOf('.cm-atomic-mermaid'));
    assert.match(mapping, /--atomic-editor-bg: var\(--background\);/);
    assert.match(mapping, /--atomic-editor-fg: var\(--foreground\);/);
    assert.match(mapping, /--atomic-editor-link: var\(--primary\);/);
    assert.match(mapping, /--atomic-editor-code-bg: var\(--code-bg\);/);
    assert.match(
      mapping,
      /--atomic-editor-body-size: var\(--atomic-user-size, var\(--vscode-editor-font-size, var\(--vscode-font-size, 13px\)\)\);/,
    );
    assert.match(mapping, /--atomic-editor-font: var\(--atomic-user-font, var\(--vscode-font-family\)\);/);
    assert.match(mapping, /--atomic-editor-body-leading: var\(--atomic-user-leading, 1\.7\);/);
    assert.match(mapping, /--atomic-editor-body-measure: var\(--atomic-user-measure, 70ch\);/);
    assert.match(mapping, /--atomic-editor-radius: var\(--radius\);/);
    assert.match(mapping, /--atomic-editor-selection-bg: color-mix\(in oklch, var\(--primary\) 26%, transparent\);/);
    assert.equal(mapping.includes('--vscode-editor-background'), false);
    assert.equal(mapping.includes('--vscode-editor-foreground'), false);
  });

  it('styles Atomic decorations with Plannotator writing treatment', () => {
    assert.match(css, /\.cm-line\.cm-atomic-h1 \{/);
    assert.match(css, /font-size: 1\.75em;/);
    assert.match(css, /\.cm-line\.cm-atomic-blockquote \{/);
    assert.match(css, /border-left: 2px solid color-mix\(in oklch, var\(--primary\) 50%, transparent\);/);
    assert.match(css, /\.cm-line\.cm-atomic-hr::after \{/);
    assert.match(css, /\.cm-line\.cm-atomic-fenced-code \{/);
    assert.match(css, /font-size: 0\.8125rem;/);
    assert.match(css, /padding-left: 1rem;/);
    assert.match(css, /\.cm-atomic-inline-code \{/);
    assert.match(css, /\.cm-atomic-table \{/);
    assert.match(css, /border-radius: var\(--radius\);/);
    assert.match(css, /\.cm-atomic-table th \{/);
    assert.match(css, /background: var\(--muted\);/);
    assert.match(css, /\.cm-atomic-task-checkbox:checked \{/);
    assert.match(css, /background: var\(--primary\);/);
    assert.match(css, /\.cm-selectionBackground \{/);
    assert.match(css, /\.cm-searchMatch \{/);
  });

  it('restyles outline and the selection bar, not a top chrome strip', () => {
    assert.match(css, /\.outline-panel \{[\s\S]*background: var\(--card/);
    assert.match(css, /\.outline-item-active \{[\s\S]*background: color-mix\(in oklch, var\(--primary/);
    assert.equal(css.includes('box-shadow: inset 2px 0 0 var(--primary'), false);
    assert.match(css, /\.selection-card:not\(\[hidden\]\) \{[\s\S]*border-radius: 14px/);
    assert.match(css, /\.selection-card-send \{[\s\S]*border-radius: 999px/);
    assert.match(css, /\.selection-pill \{[\s\S]*border-radius: 999px/);
    assert.match(css, /\.selection-card-input:focus[\s\S]*border-color: var\(--primary/);
    assert.match(css, /--radius-sm: calc\(var\(--radius\) - 4px\);/);
    assert.match(css, /outline: 2px solid var\(--ring/);
    assert.match(css, /scrollbar-width: thin;/);
    assert.equal(css.includes('.atomic-chrome'), false);
    assert.match(css, /html\.transitions-ready/);
    assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
    assert.match(css, /font-family: var\(--vscode-font-family\)/);
    assert.match(css, /font-size: var\(--vscode-font-size, 13px\)/);
  });
});
