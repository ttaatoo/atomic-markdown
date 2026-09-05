import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  ensureExtension,
  extensionForMime,
  markdownImageSnippet,
  parseImageDirectory,
  relativeMarkdownImagePath,
  sanitizeImageBasename,
  timestampBasename,
  uniqueFilename,
  untitledImageError,
  imageWriteFailedMessage,
  planSavedImagePath,
} from './imageSave.ts';

describe('parseImageDirectory', () => {
  it('defaults to assets and rejects traversal / absolute paths', () => {
    assert.deepEqual(parseImageDirectory(undefined), { ok: true, directory: 'assets' });
    assert.deepEqual(parseImageDirectory(''), { ok: true, directory: 'assets' });
    assert.deepEqual(parseImageDirectory('img/paste'), { ok: true, directory: 'img/paste' });
    assert.equal(parseImageDirectory('../secret').ok, false);
    assert.equal(parseImageDirectory('foo/../bar').ok, false);
    assert.equal(parseImageDirectory('/tmp').ok, false);
    assert.equal(parseImageDirectory('C:\\assets').ok, false);
  });
});

describe('image filenames', () => {
  it('sanitizes unsafe names and preserves known extensions', () => {
    assert.equal(sanitizeImageBasename('../../etc/passwd'), 'passwd');
    assert.equal(sanitizeImageBasename('My Photo (1).PNG'), 'My-Photo-1-.PNG');
    assert.equal(ensureExtension('shot', 'image/png'), 'shot.png');
    assert.equal(ensureExtension('shot.PNG', 'image/png'), 'shot.PNG');
    assert.equal(ensureExtension('clip', 'image/svg+xml'), 'clip.svg');
    assert.equal(extensionForMime('image/webp'), '.webp');
  });

  it('adds a counter on case-insensitive collisions', () => {
    assert.equal(uniqueFilename(['Paste.png'], 'paste.png'), 'paste-2.png');
    assert.equal(uniqueFilename(['a.png', 'a-2.png'], 'a.png'), 'a-3.png');
  });

  it('builds a relative markdown path and snippet', () => {
    assert.equal(relativeMarkdownImagePath('assets', 'paste.png'), './assets/paste.png');
    assert.equal(markdownImageSnippet('x', './assets/paste.png'), '![x](./assets/paste.png)');
    assert.match(timestampBasename(new Date('2026-09-03T16:11:22Z')), /^paste-20260903-161122$/);
  });

  it('plans a unique relative path from config, mime, and collisions', () => {
    const planned = planSavedImagePath({
      directorySetting: 'shots',
      mime: 'image/png',
      basename: '../../evil.png',
      existingNames: ['evil.png'],
      now: new Date('2026-09-03T16:11:22Z'),
    });
    assert.equal(planned.ok, true);
    if (planned.ok) {
      assert.equal(planned.directory, 'shots');
      assert.equal(planned.filename, 'evil-2.png');
      assert.equal(planned.relativePath, './shots/evil-2.png');
      assert.equal(planned.snippet, '![evil 2](./shots/evil-2.png)');
    }
  });

  it('rejects unsafe directories and unknown mime types', () => {
    assert.equal(
      planSavedImagePath({
        directorySetting: '../secret',
        mime: 'image/png',
        basename: 'a.png',
        existingNames: [],
        now: new Date(),
      }).ok,
      false,
    );
    assert.equal(
      planSavedImagePath({
        directorySetting: 'assets',
        mime: 'application/pdf',
        basename: 'a.pdf',
        existingNames: [],
        now: new Date(),
      }).ok,
      false,
    );
    assert.match(untitledImageError(), /Save the Markdown file first/);
    assert.equal(imageWriteFailedMessage('assets'), "Couldn't save image to assets/. Check folder permissions.");
    assert.equal(imageWriteFailedMessage('shots/'), "Couldn't save image to shots/. Check folder permissions.");
  });
});
