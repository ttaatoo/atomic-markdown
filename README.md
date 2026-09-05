# Atomic Markdown

A VS Code (and Cursor) custom editor that embeds [Atomic Editor](https://github.com/kenforthewin/atomic-editor) so you can write Markdown with Obsidian-style inline live preview: WYSIWYG tables, clickable task checkboxes, headings and emphasis, syntax-highlighted fences, and an optional reading mode.

**Raw markdown on disk is the source of truth.** Decorations are view-only. Copy, save, and round-trip stay byte-identical to editing the file in a plain textarea (aside from preserving the file’s existing LF/CRLF style).

The built-in text editor remains the default. This extension never takes over double-click or “Open” for `.md` files (`customEditors` priority is `option`).

This is a **v0.1 preview**. It is not published to the Marketplace and collects no telemetry.

## Screenshots

Add captures from an F5 Extension Development Host here when you have them:

- `docs/screenshots/editor.png` — edit mode with outline and selection format bar
- `docs/screenshots/reading.png` — reading mode
- `docs/screenshots/mermaid.png` — mermaid fence rendered as SVG

## Install from a VSIX

1. Download or build `atomic-markdown-0.1.0.vsix`.
2. In VS Code / Cursor: **Extensions** → `⋯` → **Install from VSIX…**
3. Reload the window if prompted.

To build the VSIX yourself (Node **22** — tests use `--experimental-strip-types`):

```bash
npm install
npm test
npm run compile
npm run package
```

`npm run compile` typechecks the extension host and webview, then bundles with esbuild. `npm run package` produces a production VSIX (`vsce --no-dependencies`).

## Open a Markdown file with Atomic Markdown

1. Open any `.md` file as usual (the default text editor).
2. Then either:
   - Command Palette → **Atomic Markdown: Open with Atomic Markdown**
   - Editor title → the preview icon
   - Explorer context menu on a `.md` file → **Open with Atomic Markdown**
   - Tab context → **Reopen Editor With…** → **Atomic Markdown**

**Open with Atomic Markdown** replaces the current text-editor tab (or an already-open text tab for that file) instead of stacking a second same-named tab. **Reopen Editor With… → Text Editor** still works.

The writing engine is [Atomic Editor](https://www.npmjs.com/package/@atomic-editor/editor) (`@atomic-editor/editor`) on CodeMirror 6. There is no vault, note graph, wiki `[[links]]`, Vim mode, collaboration, or AI chrome — just a single-file writing surface.

`retainContextWhenHidden` keeps the editor mounted when you switch tabs so the CodeMirror view is not remounted on every hide. Closing the editor disposes listeners; opening it again starts a new session.

You can open **two Atomic panels** on the same file (split), or keep the default **text editor plus Atomic** on the same document. Edits go through the VS Code `TextDocument` / `WorkspaceEdit` so the tab dirty state is shared.

## Features (v0.1)

- Inline live preview (syntax hides on inactive lines)
- No top format strip. Select text to get a compact floating bar (bold / italic / strike / code / link in edit mode, plus **Add to Chat** / **Add Comment**). Shortcuts still work with no chrome: **Cmd/Ctrl+B** bold, **Cmd/Ctrl+I** italic, **Cmd/Ctrl+K** link
- Heading outline (目录) as a Feishu-style left sidebar that resizes the writing column — ATX `#`–`######` and setext H1/H2; nested headings collapse with twisties; collapse the rail to a thin icon strip from the panel itself (no top-bar outline control); highlights the current/near-viewport heading while you scroll or edit; view-only, never writes a `[TOC]` block
- Paste or drop png/jpeg/gif/webp/svg images; the extension host saves them under `atomicMarkdown.images.directory` (default `assets` next to the Markdown file) and inserts a relative `![]()` at the caret
- WYSIWYG tables
- Clickable task checkboxes (`- [ ]` / `- [x]`)
- Fence highlighting for ~20 languages
- Mermaid fenced blocks (`mermaid` info string) render as SVG (bundled; no CDN). Invalid syntax shows an inline error; the fence text on disk is unchanged and stays editable. Scrolling through diagrams must not blank the webview (see [docs/QA.md](docs/QA.md))
- Reading mode via the editor title book/pencil icons or **Atomic Markdown: Toggle Reading Mode** (no in-webview Reading chip)
- Find inside the editor (`Cmd/Ctrl+F` while Atomic is active, or the title search icon). **Escape** closes the find bar while it is open and is not swallowed when it is closed
- Relative images via `webview.asWebviewUri`; `http`/`https` images load as-is. `data:`, `javascript:`, and `file:` image URIs are rejected.
- Writing surface colors are Plannotator’s exact default dark/light oklch tokens (not muted, not VS Code editor colors). Chrome and default body type use the workbench / editor font tokens so the pane matches Explorer and tabs. Bundled Inter / Geist Mono apply only if you set `fontFamily`. Typography settings apply live without remounting. This is not a Plannotator clone — Atomic Editor stays the engine.

http(s) links open externally. Same-workspace `.md` links use `vscode.open` (usually the default text editor).

## Image paste and drop

In **edit** mode, pasting a clipboard image or dropping an image file:

1. The webview asks the extension host to save the bytes (`vscode.workspace.fs`).
2. The host writes a unique filename under `atomicMarkdown.images.directory` (default `assets`, relative to the Markdown file). Path traversal and absolute paths are rejected.
3. The host returns a relative markdown snippet; the webview inserts it with a CodeMirror transaction (normal sync/undo).

Untitled documents (or files without a writable directory) show an error and **do not** alter the clipboard. Save the `.md` file first.

SVG files on disk are treated as untrusted image data: they are displayed with `<img>`, not executed. Inline `data:` image URIs are rejected (paste/drop saves a file instead).

## Formatting and shortcuts

There is no top Format strip. Selecting text shows a compact CodeMirror tooltip: format icons in edit mode, plus **Add to Chat** and **Add Comment**. Add Comment expands a small composer (Cancel / Send). Escape closes the composer first. The host opens Cursor Chat with a structured prompt (`Comment`, `File: path:lines`, fenced selection) via `workbench.action.chat.open`, or clipboard + `composer.newAgentChat` + paste if that command is missing. This fills the chat input; it does not create native Monaco reference chips. Pressed state reflects cheap wrap detection. Format tooltips include the shortcuts.

**Cmd/Ctrl+B**, **I**, and **K** still format with no chrome. The Command Palette **Format Selection** action still runs heading cycle and list toggles (none → H1 → H2 → H3 → none; bullet / numbered / task).

These shortcuts are scoped with `when: activeCustomEditorId == ttaatoo.atomicMarkdown` so they do not replace VS Code **Save**, **Close**, or the Command Palette.

## Outline

`atomicMarkdown.outline.enabled` (default `true`) allows a Feishu-style heading outline on the left of the webview. It opens by default when the editor is wide enough (~900px). Collapse and expand live on the outline panel (icon rail / header chevron). The command **Atomic Markdown: Toggle Outline** still works from the Command Palette / editor title. There is no outline control on a webview top bar.

The expanded rail is a **push sidebar**: it takes a fixed column and **resizes the writing surface** instead of covering it. Collapse it to a thin icon rail; expand again without losing scroll or caret. Nested headings have twisties (session-persisted). Overlay is last resort only when the frame is extremely narrow (≤240px). YAML frontmatter and `---` thematic breaks are not treated as headings.

Click a heading to reveal it. In edit mode the caret moves to the heading; in reading mode the view scrolls without forcing source chrome. The highlight follows the heading at the **visible viewport top** as you scroll (a leftover caret after an outline click does not pin it). The outline updates as you type (debounced on large documents). It never mutates the file. A note with no headings shows a styled empty state.

## Theme and typography

The writing surface uses the exact default dark and light oklch tokens from [Plannotator](https://github.com/backnotprop/plannotator) `packages/ui/themes/plannotator.css`. `followVscode` only chooses which of those two palettes matches the workbench kind — it does not remap the canvas to VS Code editor colors or desaturate primary/accent. Atomic Markdown is not Plannotator; see [PRODUCT.md](PRODUCT.md) and [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

Empty `fontFamily` and unset `fontSize` follow the VS Code workbench / editor font tokens (`--vscode-font-family`, `--vscode-editor-font-family`, `--vscode-editor-font-size` / `--vscode-font-size`). Bundled **Inter Variable** / **Geist Mono Variable** remain available if you name them in `fontFamily`. `lineHeight` (1.7) and `contentWidth` (70ch) still override measure.

| Setting | Default | Notes |
| --- | --- | --- |
| `atomicMarkdown.theme` | `followVscode` | Picks Plannotator dark or light from the workbench kind. `dark` / `light` lock one palette. |
| `atomicMarkdown.fontFamily` | `""` | Empty uses the workbench font. Name `Inter Variable` (or any stack) to override. |
| `atomicMarkdown.fontSize` | `null` | Empty follows the editor/workbench size. Clamped 12–28 when set. |
| `atomicMarkdown.lineHeight` | `1.7` | Clamped 1.2–2.4. |
| `atomicMarkdown.contentWidth` | `70` | Column measure in `ch`, clamped 40–120. |

**Atomic Markdown: Toggle Light/Dark** is always available in the editor title while Atomic is active (including `followVscode`). It writes the **opposite of the currently resolved** light/dark palette as an explicit `light` or `dark` setting. Palette, font, and measure changes apply without remounting CodeMirror. Mermaid follows `data-theme`.

## Develop with F5

1. `npm install` (Node 22)
2. Open this repository in VS Code / Cursor.
3. Press **F5** to launch an Extension Development Host with the `samples/` folder.
4. Open `welcome.md` → Command Palette → **Open with Atomic Markdown**.
5. Type, toggle a checkbox, paste an image, or use the outline. The tab should go dirty; **Save** writes the raw markdown.

Host-side undo/redo and dirty state live on the VS Code text document. See [docs/QA.md](docs/QA.md) for a manual checklist that cannot run in unit tests.

## Known limitations

- Preview / v0.1: not a Marketplace release; no telemetry
- Does not become the default editor for `.md` files
- No wiki `[[links]]`, vault, graph, collaboration, or AI
- Invalid mermaid is shown as an inline error in the live preview; this environment’s unit tests cover fence parsing and error-message shaping, not `mermaid.render` itself
- VS Code document undo (as opposed to CodeMirror’s own undo while focused in Atomic) is verified by the echo/non-echo sync helpers plus the F5 checklist, not by a VS Code-host integration test in CI
- Image paste requires a saved file with a writable directory. `data:` image URIs are rejected.
- Outline is headings only; it does not insert `[TOC]`
- Visual language is inspired by Plannotator, not pixel-identical: Atomic paints fenced code as per-line decorations (no single rounded `.pn-code` card), and heading spacing must stay modest so CM6 click targets stay honest
- `workspace.applyEdit` has no public version precondition. A foreign in-memory edit that lands *during* the `applyEdit` await can still be overwritten if VS Code accepts the full-document replace; CI tests the pre-apply abort planner, not that host race.

## License

MIT. See [LICENSE](LICENSE) and [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
