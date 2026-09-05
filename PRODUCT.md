# Atomic Markdown

A calm, focused writing surface for a single Markdown file. Craft over chrome.

Raw markdown on disk is the source of truth. The editor is a lens, not a second document.

## Personality

- **Paper, not a cockpit.** Generous measure, quiet type. Palette is Plannotator’s exact default dark/light oklch — not a muted approximation and not VS Code editor colors on the canvas. No Format ribbon. A quiet top-right pair of pills is the only app chrome on the writing column.
- **WYSIWYG via selection, not a Word ribbon.** A compact Plannotator-style icon capsule (comment, lightning quick-send, dismiss) appears when text is selected. Comment opens a card (quoted selection, expand, close). No format icons on the capsule. Format via keyboard shortcuts only.
- **Selection → Cursor Chat.** Capsule lightning or card **Send** (empty comment allowed) ships the selection. A typed note adds `Comment: …`. Fixed top **Global comment** sends an optional note plus the file (fenced when small). **Copy** asks the host to clipboard the live `TextDocument` (not a webview snapshot). Not an in-editor AI assistant and not native reference chips.
- **Feishu-style outline.** A real left sidebar rail that resizes the writing column. Collapse to a thin icon rail, expand again, and twist nested headings — all from the outline panel only. Overlay only as a last resort on an extremely narrow frame.
- **Workbench type, Plannotator color.** Chrome that remains (outline, notices, top pills, selection capsule) and default prose use VS Code workbench/editor font tokens. Inter/Geist stay optional. `followVscode` only picks which Plannotator palette to use.

## Non-goals

Not a wiki, vault, graph, Vim layer, collab session, or AI assistant. Not Plannotator. Not the default editor for `.md` files.

Atomic Editor stays the writing engine. We theme and host it; we do not replace it.
