# Changelog

## 0.1.0

- Critique pass: outline overlay drawer below ~640px (no dead Show Outline); YAML frontmatter / `---` no longer invent outline headings; image save failures show an inline notice; `prefers-reduced-motion`; larger toolbar hit targets; toolbar off by default with a Format reveal; quieter accent and follow-workbench neutrals.
- Visual fidelity: bundle Inter Variable / Geist Mono Variable; writing surface and chrome (outline, toolbar, reading chip) use Plannotator tokens and prose treatment without replacing Atomic Editor.
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
