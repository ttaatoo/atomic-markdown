import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { isFormatAction } from './protocol.ts';

describe('isFormatAction', () => {
  it('accepts known formatting actions only', () => {
    assert.equal(isFormatAction('bold'), true);
    assert.equal(isFormatAction('heading'), true);
    assert.equal(isFormatAction('taskList'), true);
    assert.equal(isFormatAction('underline'), false);
    assert.equal(isFormatAction(undefined), false);
  });
});
