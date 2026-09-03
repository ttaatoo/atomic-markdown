# Atomic Markdown

A VS Code (and Cursor) custom editor that embeds [Atomic Editor](https://github.com/kenforthewin/atomic-editor) so you can write Markdown with Obsidian-style inline live preview: WYSIWYG tables, clickable task checkboxes, headings and emphasis, syntax-highlighted fences, and an optional reading mode.

**Raw markdown on disk is the source of truth.** Decorations are view-only. Copy, save, and round-trip stay byte-identical to editing the file in a plain textarea (aside from preserving the file’s existing LF/CRLF style).

The built-in text editor remains the default. This extension never takes over double-click or “Open” for `.md` files.

## Install from a VSIX

This v1 is meant to be installed locally (not published to the Marketplace).

1. Download or build `atomic-markdown-0.1.0.vsix`.
2. In VS Code / Cursor: **Extensions** → `⋯` → **Install from VSIX…**
3. Reload the window if prompted.

To build the VSIX yourself:

```bash
npm install
npm run package
```

`npm install && npm run compile` typechecks and bundles the extension host plus the webview.

## Open a Markdown file with Atomic Markdown

1. Open any `.md` file as usual (the default text editor).
2. Then either:
   - Command Palette → **Atomic Markdown: Open with Atomic Markdown**
   - Editor title → the preview icon
   - Explorer context menu on a `.md` file → **Open with Atomic Markdown**
   - Tab context → **Reopen Editor With…** → **Atomic Markdown**

The writing engine is [Atomic Editor](https://www.npmjs.com/package/@atomic-editor/editor) (`@atomic-editor/editor`) on CodeMirror 6. There is no vault, note graph, wiki `[[links]]`, Vim mode, or collaboration chrome — just a single-file writing surface.

## Features (v1)

- Inline live preview (syntax hides on inactive lines)
- WYSIWYG tables
- Clickable task checkboxes (`- [ ]` / `- [x]`)
- Fence highlighting for ~20 languages (JavaScript, TypeScript, Python, Go, Rust, Ruby, Java, C/C++, PHP, Swift, Shell, SQL, HTML, CSS, XML, JSON, YAML, TOML, Dockerfile, Markdown)
- Mermaid fenced blocks (`mermaid` info string) render as SVG diagrams (mermaid is bundled into the webview; no CDN). Invalid syntax shows an error in place. The fence text on disk is unchanged.
- Reading mode (editor title book icon, or **Atomic Markdown: Toggle Reading Mode**)
- Find inside the editor (`Cmd/Ctrl+F`, or the title search icon)
- Relative images via `webview.asWebviewUri`; `http`/`https` images load as-is
- Colors follow the current VS Code / Cursor theme (`data-theme` light/dark)

http(s) links open externally. Same-workspace `.md` links use `vscode.open` (usually the default text editor).

## Develop with F5

1. `npm install`
2. Open this repository in VS Code / Cursor.
3. Press **F5** to launch an Extension Development Host with the `samples/` folder.
4. Open `welcome.md` → Command Palette → **Open with Atomic Markdown**.
5. Type, toggle a checkbox, or edit a table cell. The tab should go dirty; **Save** writes the raw markdown. Undo/redo and dirty state stay on the VS Code text document.

`retainContextWhenHidden` keeps the editor mounted when you switch tabs so the CodeMirror view is not remounted on every keystroke or hide.

## Not in v1

- Default / double-click takeover of `.md` files
- Wiki `[[links]]`, vaults, or a note graph
- Paste-to-save-image
- Marketplace publish or telemetry

## License

MIT. Atomic Editor is also MIT.
