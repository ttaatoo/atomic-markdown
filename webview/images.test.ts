import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { joinWebviewUri, resolveImageSrc } from './images.ts';

describe('resolveImageSrc', () => {
  const options = {
    documentDirWebviewUri: 'https://webview.example/doc/',
    workspaceWebviewUri: 'https://webview.example/ws/',
  };

  it('leaves http(s) and data URIs untouched', () => {
    assert.equal(resolveImageSrc('https://cdn.example/a.png', options), 'https://cdn.example/a.png');
    assert.equal(resolveImageSrc('data:image/png;base64,xx', options), 'data:image/png;base64,xx');
  });

  it('joins relative paths to the document directory webview URI', () => {
    assert.equal(resolveImageSrc('./pic.png', options), 'https://webview.example/doc/pic.png');
    assert.equal(resolveImageSrc('../up.png', options), 'https://webview.example/up.png');
  });

  it('joins workspace-absolute paths to the workspace webview URI', () => {
    assert.equal(resolveImageSrc('/assets/logo.svg', options), 'https://webview.example/ws/assets/logo.svg');
  });

  it('joins URL segments without dropping the last directory', () => {
    assert.equal(joinWebviewUri('https://webview.example/a/b', 'c.png'), 'https://webview.example/a/b/c.png');
  });
});
