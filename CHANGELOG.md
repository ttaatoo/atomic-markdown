# Changelog

## 0.1.0

- Feishu-style outline (目录): expanded left rail **pushes** and resizes the writing column; collapse to a thin icon rail; nested heading twisties persist for the session; chrome Hide/Show Outline always works. Overlay only as last resort at ≤240px.
- Workbench fonts by default: chrome and body use `--vscode-font-family` / `--vscode-editor-font-family` and workbench/editor size. Bundled Inter / Geist Mono stay optional via `fontFamily`. Chrome density matches VS Code side bars.
- Colors are the exact Plannotator default dark/light tokens from `packages/ui/themes/plannotator.css` (no muted/desaturated primary, no `theme-follow` workbench-neutral remap). `followVscode` only picks which palette.
- Critique pass: YAML frontmatter / `---` no longer invent outline headings; image save failures show an inline notice; `prefers-reduced-motion`; toolbar off by default with a Format reveal.
- Last-resort outline overlay (extreme narrow width) sits outside the writing-row flex; Escape/backdrop close.
- Visual fidelity: optional Inter Variable / Geist Mono Variable; writing surface uses exact Plannotator tokens and prose treatment without replacing Atomic Editor.
- UX polish: mermaid scroll no longer blanks the webview; Open with Atomic replaces the current tab; SVG toolbar with pressed states; outline highlight follows the visible heading while scrolling; Ctrl/Cmd+F opens Atomic find (not the sidebar); Escape closes find only while it is open; reading-mode chip.
- Editing reliability: per-panel sessions (`supportsMultipleEditorsPerDocument`), per-document serialized applies, versioned one-shot echo tickets, abort+catch-up when the document moves before `applyEdit`.
- Image paste/drop: extension-host `workspace.fs` save under `atomicMarkdown.images.directory` (default `assets`), relative markdown insert via a CM6 transaction.
- Compact formatting toolbar and scoped Cmd/Ctrl+B, I, K; heading cycle and list toggles.
- Heading outline panel inside the webview (no `[TOC]` injection).
- Plannotator palettes plus live typography (`fontFamily`, `fontSize`, `lineHeight`, `contentWidth`). Theme toggle visible in `followVscode`.
- Mermaid fenced blocks render as SVG in live preview; invalid diagrams show an inline error; fence text stays on disk.
- GitHub Actions CI on Node 22 (`npm test`, `compile`, `package`).
- Allowlist link/image URL schemes (`http(s)` / `mailto` / relative); reject `javascript:`, `command:`, `data:`, `file:` images, and similar.
- Initial custom text editor for `.md` files (priority `option`).
- Embeds Atomic Editor for Obsidian-style inline live preview.
- Open via command, editor title, explorer context, or Reopen Editor With.
- Reading mode, find, relative images.
