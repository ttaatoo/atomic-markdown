# Third-party notices

This file records licenses **verified from installed packages or upstream repositories** at the time of the v0.1 preview. It is not a complete dependency tree (CodeMirror, React, and other packages bundled into the webview keep their own notices in `node_modules`).

## Atomic Markdown

This repository is MIT. See [LICENSE](LICENSE). Copyright (c) 2026 ttaatoo.

## Atomic Editor (`@atomic-editor/editor` 0.6.2)

Verified from `node_modules/@atomic-editor/editor/package.json` (`"license": "MIT"`) and `node_modules/@atomic-editor/editor/LICENSE`:

MIT License

Copyright (c) 2026 Kenny Bergquist

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

Upstream: https://github.com/kenforthewin/atomic-editor

## Mermaid (`mermaid` 11.17.2)

Verified from `node_modules/mermaid/package.json` (`"license": "MIT"`) and `node_modules/mermaid/LICENSE`:

The MIT License (MIT)

Copyright (c) 2014 - 2022 Knut Sveidqvist

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

Upstream: https://github.com/mermaid-js/mermaid

## Plannotator palettes

Default dark/light oklch tokens in `webview/theme.css` are copied from
[plannotator](https://github.com/backnotprop/plannotator) `packages/ui/themes/plannotator.css`
(verified against that file on GitHub).

The upstream repository `package.json` declares `"license": "MIT OR Apache-2.0"`.
A dedicated `LICENSE` file was **not** present at the repository root at verification time;
this project therefore records the SPDX expression from `package.json` and does not invent
Apache-2.0 license text. Palette tokens are used here as a visual theme, not a vendored copy of the Plannotator application.
