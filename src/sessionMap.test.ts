import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { consumeVersionedEcho } from './sync.ts';
import { addSession, removeSession, sessionsForUri, sessionsNeedingForward } from './sessionMap.ts';

describe('sessionMap', () => {
  it('tracks multiple custom-editor sessions per document uri', () => {
    const map = new Map<string, { id: string }[]>();
    const a = { id: 'a' };
    const b = { id: 'b' };
    addSession(map, 'file:///n.md', a);
    addSession(map, 'file:///n.md', b);
    assert.equal(sessionsForUri(map, 'file:///n.md').length, 2);
    assert.equal(removeSession(map, 'file:///n.md', a), true);
    assert.deepEqual(sessionsForUri(map, 'file:///n.md').map((s) => s.id), ['b']);
    assert.equal(removeSession(map, 'file:///n.md', b), true);
    assert.equal(sessionsForUri(map, 'file:///n.md').length, 0);
  });

  it('forwards external edits to the other panel, not the writer', () => {
    const sessions = [
      { id: 'custom-a', pendingEcho: { text: 'hello\n', version: 2 } },
      { id: 'custom-b', pendingEcho: undefined },
    ];
    const need = sessionsNeedingForward(sessions, 'hello\r\n', 2, consumeVersionedEcho);
    assert.deepEqual(
      need.map((s) => s.id),
      ['custom-b'],
    );
  });

  it('forwards a later revert to A even if an old ticket also said A', () => {
    const sessions = [{ id: 'custom-a', pendingEcho: { text: 'A', version: 1 } }];
    const need = sessionsNeedingForward(sessions, 'A', 4, consumeVersionedEcho);
    assert.deepEqual(
      need.map((s) => s.id),
      ['custom-a'],
    );
  });

  it('reopening after dispose starts with an empty list for that uri', () => {
    const map = new Map<string, { id: string }[]>();
    const first = { id: '1' };
    addSession(map, 'file:///n.md', first);
    removeSession(map, 'file:///n.md', first);
    const second = { id: '2' };
    addSession(map, 'file:///n.md', second);
    assert.deepEqual(sessionsForUri(map, 'file:///n.md').map((s) => s.id), ['2']);
  });
});
