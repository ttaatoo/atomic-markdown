# Atomic Markdown

A calm, focused writing surface for a single Markdown file. Craft over chrome.

Raw markdown on disk is the source of truth. The editor is a lens, not a second document.

## Personality

- **Paper, not a cockpit.** Generous measure, quiet type. Palette is Plannotator’s exact default dark/light oklch — not a muted approximation and not VS Code editor colors on the canvas. No top interactive chrome strip.
- **WYSIWYG via selection, not a Word ribbon.** A Plannotator-style CodeMirror tooltip appears when text is selected: **Comment** / **Global comment** / **Copy** pills plus a comment card (quoted selection, expand, close). No format icons on the bar — format via keyboard shortcuts only.
- **Selection → Cursor Chat.** **Send** is enabled even with an empty comment (former Add to Chat). A typed note adds `Comment: …` to the prompt. **Global comment** sends an optional note plus the file (fenced when small). **Copy** writes the selection to the host clipboard. Not an in-editor AI assistant and not native reference chips.
- **Feishu-style outline.** A real left sidebar rail that resizes the writing column. Collapse to a thin icon rail, expand again, and twist nested headings — all from the outline panel only. Overlay only as a last resort on an extremely narrow frame.
- **Workbench type, Plannotator color.** Chrome that remains (outline, notices, selection bar) and default prose use VS Code workbench/editor font tokens. Inter/Geist stay optional. `followVscode` only picks which Plannotator palette to use.

## Non-goals

Not a wiki, vault, graph, Vim layer, collab session, or AI assistant. Not Plannotator. Not the default editor for `.md` files.

Atomic Editor stays the writing engine. We theme and host it; we do not replace it.
