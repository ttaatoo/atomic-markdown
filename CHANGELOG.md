# Changelog

## 0.1.0

- Harden document ↔ webview sync: queue host edits, drop stale generations, forward non-echo document changes, and push canonical text when `applyEdit` fails.
- Allowlist link/image URL schemes (`http(s)` / `mailto` / relative); reject `javascript:`, `command:`, `data:`, `file:` images, and similar.

- Initial custom text editor for `.md` files (priority `option`).
- Embeds Atomic Editor for Obsidian-style inline live preview.
- Open via command, editor title, explorer context, or Reopen Editor With.
- Reading mode, find, relative images, and theme-token mapping.
