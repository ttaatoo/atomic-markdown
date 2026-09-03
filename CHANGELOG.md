# Changelog

## 0.1.0

- Editing reliability: per-panel sessions (`supportsMultipleEditorsPerDocument`), serialized host edits, stale generation drop, echo vs external document changes, `applyEdit` failure catch-up.
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
