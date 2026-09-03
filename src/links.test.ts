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
    assert.deepEqual(classifyLink('HTTP://example.com/a'), {
      kind: 'external',
      href: 'HTTP://example.com/a',
    });
    assert.deepEqual(classifyLink('mailto:a@b.com'), { kind: 'external', href: 'mailto:a@b.com' });
  });

  it('rejects untrusted schemes instead of openExternal', () => {
    for (const href of [
      'javascript:alert(1)',
      'JAVASCRIPT:alert(1)',
      'command:workbench.action.files.save',
      'data:text/html;base64,PHNjcmlwdD4=',
      'vbscript:msgbox(1)',
      'vscode://file/tmp/x',
      'vscode://vscode.github-authentication/authorize',
    ]) {
      assert.deepEqual(classifyLink(href), { kind: 'ignore' }, href);
    }
  });

  it('keeps file: on the file path, not external', () => {
    assert.deepEqual(classifyLink('file:///tmp/note.md#sec'), {
      kind: 'file',
      path: 'file:///tmp/note.md',
      fragment: 'sec',
    });
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
