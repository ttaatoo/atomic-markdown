import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { hostFailureNotice } from './notices.ts';

describe('hostFailureNotice', () => {
  it('surfaces the host message and falls back when empty', () => {
    assert.equal(
      hostFailureNotice("Couldn't save image to assets/. Check folder permissions."),
      "Couldn't save image to assets/. Check folder permissions.",
    );
    assert.equal(hostFailureNotice('   '), 'Something went wrong.');
  });
});
