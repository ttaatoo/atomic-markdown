import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { imgSrcCsp } from './webviewCsp.ts';

describe('imgSrcCsp', () => {
  it('allows http(s) and the webview origin, not data:', () => {
    const directive = imgSrcCsp('https://webview.example');
    assert.equal(directive, 'img-src https://webview.example https: http:');
    assert.equal(directive.includes('data:'), false);
  });
});
