# Changelog

## 0.1.0

- No webview top chrome: Format strip, Reading chip, and top outline toggle are gone. Reading mode is command/title only. Outline collapse/expand/twisties live on the Feishu rail.
- WYSIWYG formatting via a selection floating bar (bold / italic / strike / code / link) that uses existing `dispatchFormat` helpers. Shortcuts still format with no chrome. Removed `atomicMarkdown.toolbar.enabled`.
- Selection format bar is a CodeMirror 6 `showTooltip` extension (`EXTRA_EXTENSIONS`), not a React overlay. It shows when `state.selection.main` is non-empty. Format icons hide in reading mode; Add to Chat / Add Comment remain if a selection exists. No `document.activeElement` gate.
- Selection → Cursor Chat: Add to Chat sends the selection; Add Comment opens a small composer, then Send posts comment + selection. Host prefers `workbench.action.chat.open` (Cursor ≥2.3) and falls back to clipboard + `composer.newAgentChat` + paste. Fills the chat input with structured markdown — not native Monaco reference chips.
- CSS absorb: radius ladder + `--atomic-editor-radius`, blockquote primary rail, 2px focus rings, thin scrollbars, stronger selection wash, muted HR. Palette tokens unchanged.
- Feishu-style outline (目录): expanded left rail **pushes** and resizes the writing column; collapse to a thin icon rail; nested heading twisties persist for the session. Overlay only as last resort at ≤240px.
- Workbench fonts by default: remaining chrome and body use `--vscode-font-family` / `--vscode-editor-font-family` and workbench/editor size. Bundled Inter / Geist Mono stay optional via `fontFamily`.
- Colors are the exact Plannotator default dark/light tokens from `packages/ui/themes/plannotator.css` (no muted/desaturated primary, no `theme-follow` workbench-neutral remap). `followVscode` only picks which palette.
- Critique pass: YAML frontmatter / `---` no longer invent outline headings; image save failures show an inline notice; `prefers-reduced-motion`.
- Last-resort outline overlay (extreme narrow width) sits outside the writing-row flex; Escape/backdrop close.
- Visual fidelity: optional Inter Variable / Geist Mono Variable; writing surface uses exact Plannotator tokens and prose treatment without replacing Atomic Editor.
- UX polish: mermaid scroll no longer blanks the webview; Open with Atomic replaces the current tab; outline highlight follows the visible heading while scrolling; Ctrl/Cmd+F opens Atomic find (not the sidebar); Escape closes find only while it is open.
- Editing reliability: per-panel sessions (`supportsMultipleEditorsPerDocument`), per-document serialized applies, versioned one-shot echo tickets, abort+catch-up when the document moves before `applyEdit`.
- Image paste/drop: extension-host `workspace.fs` save under `atomicMarkdown.images.directory` (default `assets`), relative markdown insert via a CM6 transaction.
- Scoped Cmd/Ctrl+B, I, K; heading cycle and list toggles via Format Selection.
- Heading outline panel inside the webview (no `[TOC]` injection).
- Plannotator palettes plus live typography (`fontFamily`, `fontSize`, `lineHeight`, `contentWidth`). Theme toggle visible in `followVscode`.
- Mermaid fenced blocks render as SVG in live preview; invalid diagrams show an inline error; fence text stays on disk.
- GitHub Actions CI on Node 22 (`npm test`, `compile`, `package`).
- Allowlist link/image URL schemes (`http(s)` / `mailto` / relative); reject `javascript:`, `command:`, `data:`, `file:` images, and similar.
- Initial custom text editor for `.md` files (priority `option`).
- Embeds Atomic Editor for Obsidian-style inline live preview.
- Open via command, editor title, explorer context, or Reopen Editor With.
- Reading mode, find, relative images.
