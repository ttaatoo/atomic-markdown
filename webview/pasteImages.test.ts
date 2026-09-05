import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { canSaveClipboardImage, dataUrlToBase64, inferImageMime } from './pasteImages.ts';

describe('clipboard image mime', () => {
  it('accepts common image types and infers from filename', () => {
    assert.equal(inferImageMime('image/png'), 'image/png');
    assert.equal(inferImageMime('image/jpg'), 'image/jpeg');
    assert.equal(inferImageMime('', 'clip.WEBP'), 'image/webp');
    assert.equal(inferImageMime('', 'diagram.svg'), 'image/svg+xml');
    assert.equal(inferImageMime('application/pdf', 'x.pdf'), undefined);
  });

  it('rejects oversized payloads and unknown types', () => {
    assert.deepEqual(canSaveClipboardImage({ mime: 'image/png', size: 10 }), { ok: true, mime: 'image/png' });
    assert.equal(canSaveClipboardImage({ mime: 'image/png', size: 9 * 1024 * 1024 }).ok, false);
    assert.equal(canSaveClipboardImage({ mime: 'text/plain', filename: 'a.txt', size: 10 }).ok, false);
  });

  it('strips a data-URL prefix to raw base64', () => {
    assert.equal(dataUrlToBase64('data:image/png;base64,QUJD'), 'QUJD');
    assert.equal(dataUrlToBase64('QUJD'), 'QUJD');
  });
});
