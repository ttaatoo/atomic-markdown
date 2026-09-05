import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const app = readFileSync(join(root, 'webview/App.tsx'), 'utf8');
const actions = readFileSync(join(root, 'webview/DocActions.tsx'), 'utf8');
const tooltip = readFileSync(join(root, 'webview/selectionFormatTooltip.ts'), 'utf8');

describe('fixed top Global comment + Copy', () => {
  it('lives in App chrome, not on the selection capsule', () => {
    assert.match(app, /<DocActions /);
    assert.match(app, /globalCommentOpen/);
    assert.match(actions, /Global comment/);
    assert.match(actions, /mode: 'global'/);
    assert.match(actions, /requestCopyText\(currentMarkdown\(\)\)/);
    assert.match(actions, /copied \? 'Copied' : 'Copy'/);
    assert.match(actions, /Add/);
    assert.match(actions, /Add a global comment/);
    assert.equal(actions.includes('Images'), false);
    assert.equal(tooltip.includes('Global comment'), false);
    assert.equal(tooltip.includes('requestCopyText'), false);
  });
});
