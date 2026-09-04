import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  appearanceFromConfig,
  clampContentWidthCh,
  clampFontSize,
  clampLineHeight,
  parseBooleanSetting,
  sanitizeFontFamily,
} from './appearance.ts';

describe('appearance clamps', () => {
  it('clamps font size, line height, and content width', () => {
    assert.equal(clampFontSize(17), 17);
    assert.equal(clampFontSize(3), 12);
    assert.equal(clampFontSize(99), 28);
    assert.equal(clampFontSize('nope'), null);
    assert.equal(clampFontSize(''), null);
    assert.equal(clampFontSize(undefined), null);
    assert.equal(clampLineHeight(1.7), 1.7);
    assert.equal(clampLineHeight(0.5), 1.2);
    assert.equal(clampLineHeight(4), 2.4);
    assert.equal(clampContentWidthCh(70), 70);
    assert.equal(clampContentWidthCh(10), 40);
    assert.equal(clampContentWidthCh(400), 120);
  });

  it('sanitizes font-family and booleans', () => {
    assert.equal(sanitizeFontFamily(''), '');
    assert.equal(sanitizeFontFamily('Georgia, serif'), 'Georgia, serif');
    assert.equal(sanitizeFontFamily('x; background: red'), '');
    assert.equal(parseBooleanSetting(false, true), false);
    assert.equal(parseBooleanSetting('yes', true), true);
  });

  it('reads appearance from a config getter', () => {
    const values: Record<string, unknown> = {
      fontFamily: 'Georgia, serif',
      fontSize: 20,
      lineHeight: 1.8,
      contentWidth: 80,
      'toolbar.enabled': false,
      'outline.enabled': true,
    };
    const appearance = appearanceFromConfig((key) => values[key], 'dark');
    assert.equal(appearance.theme, 'dark');
    assert.equal(appearance.fontFamily, 'Georgia, serif');
    assert.equal(appearance.fontSize, 20);
    assert.equal(appearance.lineHeight, 1.8);
    assert.equal(appearance.contentWidthCh, 80);
    assert.equal(appearance.toolbarEnabled, false);
    assert.equal(appearance.outlineEnabled, true);
  });

  it('defaults toolbar off and font size to the workbench', () => {
    const appearance = appearanceFromConfig(() => undefined, 'followVscode');
    assert.equal(appearance.toolbarEnabled, false);
    assert.equal(appearance.outlineEnabled, true);
    assert.equal(appearance.fontFamily, '');
    assert.equal(appearance.fontSize, null);
  });
});
