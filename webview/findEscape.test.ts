import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  isFindChrome,
  isFindOpenShortcut,
  shouldHostEscapeCloseFind,
  shouldKeymapCloseFind,
  shouldWindowCloseFind,
} from './findEscape.ts';

describe('find Escape', () => {
  it('closes from the window handler whenever find is open (not only when the input is focused)', () => {
    assert.equal(shouldWindowCloseFind({ searchOpen: true }), true);
    assert.equal(shouldWindowCloseFind({ searchOpen: false }), false);
  });

  it('closes from the CM6 keymap whenever the search panel is open', () => {
    assert.equal(shouldKeymapCloseFind(true), true);
    assert.equal(shouldKeymapCloseFind(false), false);
  });

  it('does not treat Escape as a host binding when find is closed', () => {
    assert.equal(shouldHostEscapeCloseFind(true), true);
    assert.equal(shouldHostEscapeCloseFind(false), false);
  });

  it('recognizes Ctrl/Cmd+F without Alt as the in-editor find shortcut', () => {
    assert.equal(isFindOpenShortcut({ key: 'f', ctrlOrMeta: true, alt: false }), true);
    assert.equal(isFindOpenShortcut({ key: 'F', ctrlOrMeta: true, alt: false }), true);
    assert.equal(isFindOpenShortcut({ key: 'f', ctrlOrMeta: true, alt: true }), false);
    assert.equal(isFindOpenShortcut({ key: 'f', ctrlOrMeta: false, alt: false }), false);
  });

  it('recognizes Atomic/CM6 find panel nodes', () => {
    assert.equal(
      isFindChrome({
        closest: (sel) => (sel.includes('.cm-search') ? {} : null),
      }),
      true,
    );
    assert.equal(
      isFindChrome({
        closest: () => null,
      }),
      false,
    );
    assert.equal(isFindChrome(null), false);
  });
});
