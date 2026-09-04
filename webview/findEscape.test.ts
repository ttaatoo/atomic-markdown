import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { isFindChrome, shouldKeymapCloseFind, shouldWindowCloseFind } from './findEscape.ts';

describe('find Escape', () => {
  it('closes from the window handler only when find chrome is focused', () => {
    assert.equal(shouldWindowCloseFind({ searchOpen: true, inFindChrome: true }), true);
    assert.equal(shouldWindowCloseFind({ searchOpen: true, inFindChrome: false }), false);
    assert.equal(shouldWindowCloseFind({ searchOpen: false, inFindChrome: true }), false);
  });

  it('closes from the CM6 keymap whenever the search panel is open', () => {
    assert.equal(shouldKeymapCloseFind(true), true);
    assert.equal(shouldKeymapCloseFind(false), false);
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
