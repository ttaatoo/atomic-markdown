import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  findMermaidFenceRanges,
  isMermaidLanguage,
  mermaidErrorMessage,
  mermaidThemeFromDataset,
  parseMermaidFence,
  planMermaidDecorations,
} from './mermaidFences.ts';

const welcome = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '../samples/welcome.md'),
  'utf8',
);

describe('isMermaidLanguage', () => {
  it('matches the first info-string token only', () => {
    assert.equal(isMermaidLanguage('mermaid'), true);
    assert.equal(isMermaidLanguage('MERMAID'), true);
    assert.equal(isMermaidLanguage(' mermaid '), true);
    assert.equal(isMermaidLanguage('mermaid extra'), true);
    assert.equal(isMermaidLanguage('mermaidjs'), false);
    assert.equal(isMermaidLanguage('js'), false);
    assert.equal(isMermaidLanguage('javascript'), false);
    assert.equal(isMermaidLanguage(''), false);
    assert.equal(isMermaidLanguage(undefined), false);
  });
});

describe('parseMermaidFence / findMermaidFenceRanges', () => {
  const flowchart = `\`\`\`mermaid
flowchart LR
  md[Raw markdown] --> atomic[Atomic Editor]
\`\`\``;

  it('extracts body from a complete backtick fence', () => {
    const parsed = parseMermaidFence(flowchart);
    assert.ok(parsed);
    assert.equal(parsed.info, 'mermaid');
    assert.equal(parsed.body, 'flowchart LR\n  md[Raw markdown] --> atomic[Atomic Editor]');
  });

  it('accepts tilde fences and extra info tokens', () => {
    const parsed = parseMermaidFence('~~~mermaid theme\ngraph TD\n  A-->B\n~~~');
    assert.ok(parsed);
    assert.equal(parsed.info, 'mermaid theme');
    assert.equal(parsed.body, 'graph TD\n  A-->B');
  });

  it('requires a matching closer (incomplete fences are not diagrams)', () => {
    assert.equal(parseMermaidFence('```mermaid\ngraph TD\n  A-->B\n'), undefined);
    assert.deepEqual(findMermaidFenceRanges('```mermaid\ngraph TD\n  A-->B\n'), []);
  });

  it('does not treat a shorter closer or info-bearing closer as the end', () => {
    assert.equal(parseMermaidFence('````mermaid\nfoo\n```'), undefined);
    assert.equal(parseMermaidFence('```mermaid\nfoo\n```mermaid\n'), undefined);
    const nested = findMermaidFenceRanges('````mermaid\n```\nstill mermaid\n````\n');
    assert.equal(nested.length, 1);
    assert.equal(nested[0]?.body, '```\nstill mermaid');
  });

  it('skips non-mermaid fences and 4-space indented openers', () => {
    const md = ['```js', 'const x = 1;', '```', '', '    ```mermaid', '    graph TD', '    ```'].join(
      '\n',
    );
    assert.deepEqual(findMermaidFenceRanges(md), []);
  });

  it('finds multiple complete fences with correct offsets', () => {
    const md = 'intro\n\n```mermaid\ngraph TD\nA-->B\n```\n\nmid\n\n```mermaid\npie\n```\n';
    const ranges = findMermaidFenceRanges(md);
    assert.equal(ranges.length, 2);
    assert.equal(md.slice(ranges[0].from, ranges[0].to), '```mermaid\ngraph TD\nA-->B\n```\n');
    assert.equal(ranges[0].body, 'graph TD\nA-->B');
    assert.equal(ranges[1].body, 'pie');
  });

  it('parses the welcome.md mermaid fixtures as two closed fences', () => {
    const ranges = findMermaidFenceRanges(welcome);
    assert.ok(ranges.length >= 2, `expected at least two mermaid fences, got ${ranges.length}`);
    assert.match(ranges[0].body, /flowchart LR/);
    assert.match(ranges[1].body, /sequenceDiagram/);
    for (const range of ranges) {
      assert.equal(welcome.slice(range.from, range.from + 3), '```');
      assert.match(welcome.slice(range.from, range.to), /```mermaid[\s\S]*```/);
    }
  });
});

describe('planMermaidDecorations', () => {
  const md = 'hello\n\n```mermaid\ngraph TD\nA-->B\n```\n\n```mermaid\npie\n```\n';
  const fences = findMermaidFenceRanges(md);
  assert.equal(fences.length, 2);

  it('replaces inactive fences and previews the fence that holds the caret', () => {
    const outside = planMermaidDecorations(md, { readOnly: false, ranges: [{ from: 0, to: 0 }] });
    assert.deepEqual(
      outside.map((p) => p.kind),
      ['replace', 'replace'],
    );

    const inFirst = planMermaidDecorations(md, {
      readOnly: false,
      ranges: [{ from: fences[0].from + 12, to: fences[0].from + 12 }],
    });
    assert.equal(inFirst[0]?.kind, 'preview');
    assert.equal(inFirst[1]?.kind, 'replace');
    assert.equal(inFirst[0]?.body, 'graph TD\nA-->B');
  });

  it('keeps diagrams replaced in reading mode even when the caret is inside', () => {
    const plans = planMermaidDecorations(md, {
      readOnly: true,
      ranges: [{ from: fences[0].from + 12, to: fences[0].from + 12 }],
    });
    assert.deepEqual(
      plans.map((p) => p.kind),
      ['replace', 'replace'],
    );
  });
});

describe('mermaid helpers', () => {
  it('maps workbench data-theme onto mermaid theme names', () => {
    assert.equal(mermaidThemeFromDataset('light'), 'default');
    assert.equal(mermaidThemeFromDataset('dark'), 'dark');
    assert.equal(mermaidThemeFromDataset(undefined), 'dark');
  });

  it('extracts an error message without inventing a render success', () => {
    assert.equal(mermaidErrorMessage(new Error('Parse error on line 2')), 'Parse error on line 2');
    assert.equal(mermaidErrorMessage('nope'), 'nope');
    assert.equal(mermaidErrorMessage({}), 'Invalid mermaid diagram');
  });

  it('keeps invalid mermaid source in the fence body so the document stays editable', () => {
    const md = '```mermaid\nthis is not a diagram\n```\n';
    const ranges = findMermaidFenceRanges(md);
    assert.equal(ranges.length, 1);
    assert.equal(ranges[0]?.body, 'this is not a diagram');
    assert.equal(md.includes('this is not a diagram'), true);
  });
});
