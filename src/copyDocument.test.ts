import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { DOCUMENT_COPY_FAILED, planCopyDocument, writeDocumentCopy } from './copyDocument.ts';

describe('planCopyDocument', () => {
  it('copies the host document text and ignores any webview payload', () => {
    const planned = planCopyDocument({ documentText: '# Welcome\n\nRaw markdown is the source of truth.\n' });
    assert.equal(planned.text, '# Welcome\n\nRaw markdown is the source of truth.\n');
    assert.equal(planned.text.includes('webview'), false);
  });
});

describe('writeDocumentCopy', () => {
  it('writes the planned document text to the clipboard', async () => {
    const written: string[] = [];
    const result = await writeDocumentCopy('file body', async (text) => {
      written.push(text);
    });
    assert.deepEqual(result, { ok: true });
    assert.deepEqual(written, ['file body']);
  });

  it('returns a stable failure when the clipboard write throws', async () => {
    const result = await writeDocumentCopy('file body', async () => {
      throw new Error('denied');
    });
    assert.deepEqual(result, { ok: false, message: DOCUMENT_COPY_FAILED });
  });
});
