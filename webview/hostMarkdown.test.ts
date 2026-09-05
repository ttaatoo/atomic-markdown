import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { isStaleHostMarkdown, markdownForMount, takeNewerMarkdown } from './hostMarkdown.ts';

describe('host markdown generation', () => {
  it('treats a lower generation as stale', () => {
    assert.equal(isStaleHostMarkdown(3, 4), true);
    assert.equal(isStaleHostMarkdown(4, 4), false);
    assert.equal(isStaleHostMarkdown(5, 4), false);
  });

  it('queues the latest non-stale payload and ignores an older one', () => {
    const first = takeNewerMarkdown(undefined, { text: 'a', generation: 2 }, 0);
    assert.deepEqual(first, { text: 'a', generation: 2 });

    const newer = takeNewerMarkdown(first, { text: 'b', generation: 5 }, 2);
    assert.deepEqual(newer, { text: 'b', generation: 5 });

    const stale = takeNewerMarkdown(newer, { text: 'old', generation: 4 }, 5);
    assert.deepEqual(stale, newer);
  });

  it('folds a newer queued setMarkdown into mount text', () => {
    assert.deepEqual(
      markdownForMount({ text: 'init', generation: 1 }, { text: 'queued', generation: 3 }),
      { text: 'queued', generation: 3 },
    );
    assert.deepEqual(
      markdownForMount({ text: 'init', generation: 4 }, { text: 'queued', generation: 3 }),
      { text: 'init', generation: 4 },
    );
    assert.deepEqual(markdownForMount({ text: 'init', generation: 1 }, undefined), {
      text: 'init',
      generation: 1,
    });
  });
});
