import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { formatActionTitle, modifierGlyph, outlineToggleTitle } from './toolbarLabels.ts';

describe('format and outline labels', () => {
  it('uses platform shortcuts for bold, italic, and link', () => {
    assert.equal(modifierGlyph('MacIntel'), '⌘');
    assert.equal(modifierGlyph('Win32'), 'Ctrl+');
    assert.equal(formatActionTitle('bold', 'MacIntel'), 'Bold (⌘B)');
    assert.equal(formatActionTitle('italic', 'Win32'), 'Italic (Ctrl+I)');
    assert.equal(formatActionTitle('link', 'Linux x86_64'), 'Link (Ctrl+K)');
    assert.equal(formatActionTitle('strike', 'MacIntel'), 'Strikethrough');
    assert.equal(formatActionTitle('heading', 'MacIntel'), 'Cycle heading');
  });

  it('keeps outline hide/show language on the panel only', () => {
    assert.equal(outlineToggleTitle(false), 'Show outline');
    assert.equal(outlineToggleTitle(true), 'Hide outline');
  });
});
