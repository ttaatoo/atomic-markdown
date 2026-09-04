import assert from 'node:assert/strict';
import test from 'node:test';
import { mermaidErrorBoundary, mermaidErrorMessage, safeMermaidRender } from './mermaidIsolation.ts';

test('mermaidErrorBoundary returns fallback instead of throwing', () => {
  const out = mermaidErrorBoundary(
    () => {
      throw new Error('Parse error on line 2');
    },
    (err) => mermaidErrorMessage(err),
  );
  assert.equal(out, 'Parse error on line 2');
});

test('safeMermaidRender isolates rejected mermaid.render', async () => {
  const result = await safeMermaidRender(async () => {
    throw new Error('Syntax error in graph');
  });
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.match(result.message, /Syntax error/);
  }
});

test('safeMermaidRender resolves ok on success', async () => {
  const result = await safeMermaidRender(async () => undefined);
  assert.equal(result.ok, true);
});
