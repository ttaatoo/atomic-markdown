import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { applyPaletteToRoot, workbenchIsLightFromBody } from './theme.ts';

describe('workbenchIsLightFromBody', () => {
  it('reads VS Code webview body classes', () => {
    assert.equal(workbenchIsLightFromBody({ classList: { contains: (name) => name === 'vscode-light' } }), true);
    assert.equal(
      workbenchIsLightFromBody({ classList: { contains: (name) => name === 'vscode-high-contrast-light' } }),
      true,
    );
    assert.equal(workbenchIsLightFromBody({ classList: { contains: (name) => name === 'vscode-dark' } }), false);
  });
});

describe('applyPaletteToRoot', () => {
  it('sets theme-plannotator, optional light, and data-theme without remounting', () => {
    const classes = new Set<string>();
    const root = {
      classList: {
        add: (name: string) => {
          classes.add(name);
        },
        toggle: (name: string, force?: boolean) => {
          if (force) {
            classes.add(name);
          } else {
            classes.delete(name);
          }
          return Boolean(force);
        },
      },
      dataset: {} as { theme?: string },
    };

    applyPaletteToRoot(root, 'dark');
    assert.equal(classes.has('theme-plannotator'), true);
    assert.equal(classes.has('light'), false);
    assert.equal(root.dataset.theme, 'dark');

    applyPaletteToRoot(root, 'light');
    assert.equal(classes.has('theme-plannotator'), true);
    assert.equal(classes.has('light'), true);
    assert.equal(root.dataset.theme, 'light');
  });
});
