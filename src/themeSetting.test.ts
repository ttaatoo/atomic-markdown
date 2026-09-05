import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  htmlThemeClass,
  nextExplicitTheme,
  parseThemeSetting,
  resolvePaletteKind,
  themeConfigurationTarget,
  workbenchKindIsLight,
} from './themeSetting.ts';

describe('parseThemeSetting', () => {
  it('accepts the three setting values and defaults anything else', () => {
    assert.equal(parseThemeSetting('dark'), 'dark');
    assert.equal(parseThemeSetting('light'), 'light');
    assert.equal(parseThemeSetting('followVscode'), 'followVscode');
    assert.equal(parseThemeSetting('vscode'), 'followVscode');
    assert.equal(parseThemeSetting(undefined), 'followVscode');
  });
});

describe('resolvePaletteKind', () => {
  it('honors an explicit palette and ignores the workbench', () => {
    assert.equal(resolvePaletteKind('light', false), 'light');
    assert.equal(resolvePaletteKind('dark', true), 'dark');
  });

  it('picks a Plannotator palette from the workbench kind when following', () => {
    assert.equal(resolvePaletteKind('followVscode', true), 'light');
    assert.equal(resolvePaletteKind('followVscode', false), 'dark');
  });
});

describe('toggle and html class', () => {
  it('flips the resolved side to an explicit light/dark write', () => {
    assert.equal(nextExplicitTheme('dark'), 'light');
    assert.equal(nextExplicitTheme('light'), 'dark');
  });

  it('stamps theme-plannotator and optional light on <html>', () => {
    assert.equal(htmlThemeClass('dark'), 'theme-plannotator');
    assert.equal(htmlThemeClass('light'), 'theme-plannotator light');
  });

  it('writes workspace settings when a folder is open, else global', () => {
    assert.equal(themeConfigurationTarget(true), 'workspace');
    assert.equal(themeConfigurationTarget(false), 'global');
  });

  it('treats VS Code Light and HighContrastLight as light workbenches', () => {
    assert.equal(workbenchKindIsLight(1), true);
    assert.equal(workbenchKindIsLight(4), true);
    assert.equal(workbenchKindIsLight(2), false);
    assert.equal(workbenchKindIsLight(3), false);
  });
});
