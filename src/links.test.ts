import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { classifyLink } from './links.ts';

describe('classifyLink', () => {
  it('ignores empty and in-document hashes', () => {
    assert.deepEqual(classifyLink(''), { kind: 'ignore' });
    assert.deepEqual(classifyLink('#heading'), { kind: 'ignore' });
  });

  it('treats http(s) and mailto as external', () => {
    assert.deepEqual(classifyLink('https://example.com'), {
      kind: 'external',
      href: 'https://example.com',
    });
    assert.deepEqual(classifyLink('mailto:a@b.com'), { kind: 'external', href: 'mailto:a@b.com' });
  });

  it('treats relative and workspace paths as files', () => {
    assert.deepEqual(classifyLink('./other.md'), { kind: 'file', path: './other.md', fragment: undefined });
    assert.deepEqual(classifyLink('/docs/note.md#sec'), {
      kind: 'file',
      path: '/docs/note.md',
      fragment: 'sec',
    });
  });
});
