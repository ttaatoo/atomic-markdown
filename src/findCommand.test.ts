import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  CLOSE_FIND_WHEN,
  FIND_WHEN,
  FIND_WHEN_ACTIVE,
  FIND_WHEN_WEBVIEW,
  planCloseFind,
  planFindInEditor,
} from './findCommand.ts';

describe('planFindInEditor', () => {
  it('focuses the webview and posts openSearch when a session is active', () => {
    assert.deepEqual(planFindInEditor(true), { focusWebview: true, post: 'openSearch' });
    assert.deepEqual(planFindInEditor(false), { focusWebview: false, post: null });
  });

  it('posts closeSearch only when a session exists', () => {
    assert.deepEqual(planCloseFind(true), { post: 'closeSearch' });
    assert.deepEqual(planCloseFind(false), { post: null });
  });
});

describe('package.json find keybindings', () => {
  const pkg = JSON.parse(
    readFileSync(join(dirname(fileURLToPath(import.meta.url)), '../package.json'), 'utf8'),
  ) as {
    contributes: {
      keybindings: Array<{ command: string; key: string; mac?: string; when: string }>;
    };
  };

  it('routes Ctrl/Cmd+F to atomicMarkdown.find without requiring editorTextFocus', () => {
    const finds = pkg.contributes.keybindings.filter((binding) => binding.command === 'atomicMarkdown.find');
    assert.ok(finds.length >= 1);
    for (const binding of finds) {
      assert.equal(binding.key, 'ctrl+f');
      assert.equal(binding.mac, 'cmd+f');
      assert.match(binding.when, /activeCustomEditorId == ttaatoo\.atomicMarkdown/);
      assert.equal(binding.when.includes('editorTextFocus') && !binding.when.includes('!editorTextFocus'), false);
    }
    const whens = finds.map((binding) => binding.when);
    assert.ok(whens.includes(FIND_WHEN) || whens.includes(FIND_WHEN_ACTIVE) || whens.includes(FIND_WHEN_WEBVIEW));
  });

  it('binds Escape to closeFind only while atomicMarkdown.findOpen', () => {
    const escapes = pkg.contributes.keybindings.filter((binding) => binding.command === 'atomicMarkdown.closeFind');
    assert.equal(escapes.length, 1);
    assert.equal(escapes[0]?.key, 'escape');
    assert.equal(escapes[0]?.when, CLOSE_FIND_WHEN);
  });
});
