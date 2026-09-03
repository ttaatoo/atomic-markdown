import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  hasRejectedMediaScheme,
  joinWebviewUri,
  resolveImageSrc,
  rewriteImagesIn,
} from './images.ts';

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

  it('rejects javascript:, file:, and other non-allowlisted schemes', () => {
    assert.equal(resolveImageSrc('javascript:alert(1)', options), undefined);
    assert.equal(resolveImageSrc('JAVASCRIPT:alert(1)', options), undefined);
    assert.equal(resolveImageSrc('file:///tmp/secret.png', options), undefined);
    assert.equal(resolveImageSrc('vbscript:msgbox(1)', options), undefined);
    assert.equal(hasRejectedMediaScheme('javascript:alert(1)'), true);
    assert.equal(hasRejectedMediaScheme('./ok.png'), false);
  });

  it('does not let javascript: survive new URL() joining', () => {
    assert.throws(() => joinWebviewUri('https://webview.example/doc/', 'javascript:alert(1)'));
    assert.equal(resolveImageSrc('javascript:alert(1)', options), undefined);
  });

  it('leaves src unchanged when URL joining throws', () => {
    assert.equal(resolveImageSrc('./pic.png', { documentDirWebviewUri: 'not-a-url' }), './pic.png');
    assert.throws(() => joinWebviewUri('not-a-url', './pic.png'));
  });
});

describe('rewriteImagesIn', () => {
  it('clears rejected schemes and keeps going after a throw', () => {
    const calls: string[] = [];
    const rejected = fakeImg('javascript:alert(1)');
    const relative = fakeImg('./ok.png');
    const throwing = {
      get querySelectorAll() {
        return () => {
          throw new Error('should not be used');
        };
      },
    };

    const root = {
      querySelectorAll: (selector: string) => {
        assert.equal(selector, 'img');
        return [
          rejected,
          {
            get dataset() {
              calls.push('throwing');
              throw new Error('bad img');
            },
          },
          relative,
        ];
      },
    } as unknown as ParentNode;

    rewriteImagesIn(root, { documentDirWebviewUri: 'https://webview.example/doc/' });
    assert.equal(rejected.getAttribute('src'), null);
    assert.equal(relative.getAttribute('src'), 'https://webview.example/doc/ok.png');
    assert.equal(calls.includes('throwing'), true);
    void throwing;
  });
});

function fakeImg(src: string): HTMLImageElement {
  const attrs = new Map<string, string>([['src', src]]);
  const dataset: Record<string, string> = {};
  return {
    dataset,
    getAttribute: (name: string) => attrs.get(name) ?? null,
    setAttribute: (name: string, value: string) => {
      attrs.set(name, value);
    },
    removeAttribute: (name: string) => {
      attrs.delete(name);
    },
  } as unknown as HTMLImageElement;
}
