import { cpp } from '@codemirror/lang-cpp';
import { css } from '@codemirror/lang-css';
import { go } from '@codemirror/lang-go';
import { html } from '@codemirror/lang-html';
import { java } from '@codemirror/lang-java';
import { javascript } from '@codemirror/lang-javascript';
import { json } from '@codemirror/lang-json';
import { markdown } from '@codemirror/lang-markdown';
import { php } from '@codemirror/lang-php';
import { python } from '@codemirror/lang-python';
import { rust } from '@codemirror/lang-rust';
import { sql } from '@codemirror/lang-sql';
import { xml } from '@codemirror/lang-xml';
import { yaml } from '@codemirror/lang-yaml';
import {
  LanguageDescription,
  LanguageSupport,
  StreamLanguage,
  type StreamParser,
} from '@codemirror/language';
import { dockerFile } from '@codemirror/legacy-modes/mode/dockerfile';
import { ruby } from '@codemirror/legacy-modes/mode/ruby';
import { shell } from '@codemirror/legacy-modes/mode/shell';
import { swift } from '@codemirror/legacy-modes/mode/swift';
import { toml } from '@codemirror/legacy-modes/mode/toml';

function legacy(parser: StreamParser<unknown>): LanguageSupport {
  return new LanguageSupport(StreamLanguage.define(parser));
}

/**
 * Same catalog as ATOMIC_CODE_LANGUAGES, but each grammar is imported
 * statically so esbuild inlines it. Dynamic import() of lang packages
 * 404s inside a VS Code webview CSP.
 */
export const CODE_LANGUAGES: LanguageDescription[] = [
  LanguageDescription.of({
    name: 'JavaScript',
    alias: ['js', 'jsx'],
    extensions: ['js', 'mjs', 'cjs', 'jsx'],
    load: () => Promise.resolve(javascript({ jsx: true })),
  }),
  LanguageDescription.of({
    name: 'TypeScript',
    alias: ['ts', 'tsx'],
    extensions: ['ts', 'mts', 'cts', 'tsx'],
    load: () => Promise.resolve(javascript({ typescript: true, jsx: true })),
  }),
  LanguageDescription.of({
    name: 'Python',
    alias: ['py'],
    extensions: ['py'],
    load: () => Promise.resolve(python()),
  }),
  LanguageDescription.of({
    name: 'Go',
    extensions: ['go'],
    load: () => Promise.resolve(go()),
  }),
  LanguageDescription.of({
    name: 'Rust',
    alias: ['rs'],
    extensions: ['rs'],
    load: () => Promise.resolve(rust()),
  }),
  LanguageDescription.of({
    name: 'Ruby',
    alias: ['rb'],
    extensions: ['rb'],
    load: () => Promise.resolve(legacy(ruby)),
  }),
  LanguageDescription.of({
    name: 'Java',
    extensions: ['java'],
    load: () => Promise.resolve(java()),
  }),
  LanguageDescription.of({
    name: 'C',
    extensions: ['c', 'h'],
    load: () => Promise.resolve(cpp()),
  }),
  LanguageDescription.of({
    name: 'C++',
    alias: ['cpp'],
    extensions: ['cpp', 'c++', 'cc', 'cxx', 'hpp', 'h++', 'hh', 'hxx'],
    load: () => Promise.resolve(cpp()),
  }),
  LanguageDescription.of({
    name: 'PHP',
    extensions: ['php'],
    load: () => Promise.resolve(php()),
  }),
  LanguageDescription.of({
    name: 'Swift',
    extensions: ['swift'],
    load: () => Promise.resolve(legacy(swift)),
  }),
  LanguageDescription.of({
    name: 'Shell',
    alias: ['bash', 'sh', 'zsh'],
    extensions: ['sh', 'bash', 'zsh'],
    load: () => Promise.resolve(legacy(shell)),
  }),
  LanguageDescription.of({
    name: 'SQL',
    extensions: ['sql'],
    load: () => Promise.resolve(sql()),
  }),
  LanguageDescription.of({
    name: 'HTML',
    alias: ['htm'],
    extensions: ['html', 'htm'],
    load: () => Promise.resolve(html()),
  }),
  LanguageDescription.of({
    name: 'CSS',
    extensions: ['css'],
    load: () => Promise.resolve(css()),
  }),
  LanguageDescription.of({
    name: 'XML',
    extensions: ['xml'],
    load: () => Promise.resolve(xml()),
  }),
  LanguageDescription.of({
    name: 'JSON',
    extensions: ['json'],
    load: () => Promise.resolve(json()),
  }),
  LanguageDescription.of({
    name: 'YAML',
    alias: ['yml'],
    extensions: ['yaml', 'yml'],
    load: () => Promise.resolve(yaml()),
  }),
  LanguageDescription.of({
    name: 'TOML',
    extensions: ['toml'],
    load: () => Promise.resolve(legacy(toml)),
  }),
  LanguageDescription.of({
    name: 'Dockerfile',
    filename: /^Dockerfile$/,
    load: () => Promise.resolve(legacy(dockerFile)),
  }),
  LanguageDescription.of({
    name: 'Markdown',
    alias: ['md'],
    extensions: ['md', 'markdown', 'mkd'],
    load: () => Promise.resolve(markdown()),
  }),
];
