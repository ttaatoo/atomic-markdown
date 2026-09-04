import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { appearanceCssVars, applyAppearanceVars, applyPaletteToRoot, workbenchIsLightFromBody } from './theme.ts';

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

    applyPaletteToRoot(root, 'dark', true);
    assert.equal(classes.has('theme-plannotator'), true);
    assert.equal(classes.has('theme-follow'), true);
    assert.equal(classes.has('light'), false);
    assert.equal(root.dataset.theme, 'dark');

    applyPaletteToRoot(root, 'light', false);
    assert.equal(classes.has('theme-plannotator'), true);
    assert.equal(classes.has('light'), true);
    assert.equal(classes.has('theme-follow'), false);
    assert.equal(root.dataset.theme, 'light');
  });
});

describe('appearance CSS variables', () => {
  it('omits font-family when empty and writes size/leading/measure', () => {
    const vars = appearanceCssVars({
      theme: 'dark',
      fontFamily: '',
      fontSize: 18,
      lineHeight: 1.6,
      contentWidthCh: 72,
      toolbarEnabled: true,
      outlineEnabled: true,
    });
    assert.equal(vars['--atomic-user-font'], null);
    assert.equal(vars['--atomic-user-size'], '18px');
    assert.equal(vars['--atomic-user-leading'], '1.6');
    assert.equal(vars['--atomic-user-measure'], '72ch');
  });

  it('applies and removes properties without requiring a remount', () => {
    const store = new Map<string, string>();
    const style = {
      setProperty: (name: string, value: string) => {
        store.set(name, value);
      },
      removeProperty: (name: string) => {
        store.delete(name);
      },
    };
    applyAppearanceVars(style, {
      theme: 'light',
      fontFamily: 'Georgia, serif',
      fontSize: 17,
      lineHeight: 1.7,
      contentWidthCh: 70,
      toolbarEnabled: true,
      outlineEnabled: true,
    });
    assert.equal(store.get('--atomic-user-font'), 'Georgia, serif');
    applyAppearanceVars(style, {
      theme: 'light',
      fontFamily: '',
      fontSize: 17,
      lineHeight: 1.7,
      contentWidthCh: 70,
      toolbarEnabled: true,
      outlineEnabled: true,
    });
    assert.equal(store.has('--atomic-user-font'), false);
  });
});
