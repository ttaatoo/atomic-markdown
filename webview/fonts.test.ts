import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const fontsCss = readFileSync(join(root, 'webview/fonts.css'), 'utf8');
const indexTsx = readFileSync(join(root, 'webview/index.tsx'), 'utf8');
const esbuild = readFileSync(join(root, 'esbuild.mjs'), 'utf8');
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')) as {
  dependencies: Record<string, string>;
  contributes: { configuration: { properties: Record<string, { description?: string }> } };
};

describe('bundled Inter / Geist Mono', () => {
  it('declares latin Inter Variable and Geist Mono Variable faces', () => {
    assert.match(fontsCss, /font-family: 'Inter Variable';/);
    assert.match(fontsCss, /font-family: 'Geist Mono Variable';/);
    assert.match(fontsCss, /inter-latin-wght-normal\.woff2/);
    assert.match(fontsCss, /inter-latin-wght-italic\.woff2/);
    assert.match(fontsCss, /geist-mono-latin-wght-normal\.woff2/);
    assert.equal(fontsCss.includes('inter-cyrillic'), false);
    assert.equal(fontsCss.includes('inter-greek'), false);
    assert.equal(fontsCss.includes('inter-vietnamese'), false);
    assert.equal(fontsCss.includes('geist-mono-cyrillic'), false);
  });

  it('imports fonts before theme.css and emits woff2 as files', () => {
    assert.match(indexTsx, /import '\.\/fonts\.css';/);
    const fontsAt = indexTsx.indexOf("import './fonts.css';");
    const themeAt = indexTsx.indexOf("import './theme.css';");
    assert.ok(fontsAt >= 0 && themeAt > fontsAt);
    assert.match(esbuild, /'\.woff2': 'file'/);
  });

  it('depends on fontsource-variable packages and documents the default stack', () => {
    assert.ok(pkg.dependencies['@fontsource-variable/inter']);
    assert.ok(pkg.dependencies['@fontsource-variable/geist-mono']);
    assert.match(
      pkg.contributes.configuration.properties['atomicMarkdown.fontFamily'].description ?? '',
      /Inter Variable/,
    );
    const latin = [
      'node_modules/@fontsource-variable/inter/files/inter-latin-wght-normal.woff2',
      'node_modules/@fontsource-variable/inter/files/inter-latin-wght-italic.woff2',
      'node_modules/@fontsource-variable/geist-mono/files/geist-mono-latin-wght-normal.woff2',
    ];
    for (const rel of latin) {
      assert.equal(existsSync(join(root, rel)), true, rel);
    }
  });
});
