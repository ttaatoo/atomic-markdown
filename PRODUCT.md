# Atomic Markdown

A calm, focused writing surface for a single Markdown file. Craft over chrome.

Raw markdown on disk is the source of truth. The editor is a lens, not a second document.

## Personality

- **Paper, not a cockpit.** Generous measure, quiet type. Palette is Plannotator’s exact default dark/light oklch — not a muted approximation and not VS Code editor colors on the canvas. No top interactive chrome strip.
- **WYSIWYG via selection, not a Word ribbon.** A compact CodeMirror tooltip appears when text is selected: format icons (edit mode) plus Add to Chat / Add Comment. Add Comment opens a small composer on the same tooltip. Keyboard shortcuts still format with no chrome on screen.
- **Selection → Cursor Chat.** The host fills Cursor Chat with a structured prompt (optional comment, `File: path:start-end`, fenced selection). Not an in-editor AI assistant and not native reference chips.
- **Feishu-style outline.** A real left sidebar rail that resizes the writing column. Collapse to a thin icon rail, expand again, and twist nested headings — all from the outline panel only. Overlay only as a last resort on an extremely narrow frame.
- **Workbench type, Plannotator color.** Chrome that remains (outline, notices, selection bar) and default prose use VS Code workbench/editor font tokens. Inter/Geist stay optional. `followVscode` only picks which Plannotator palette to use.

## Non-goals

Not a wiki, vault, graph, Vim layer, collab session, or AI assistant. Not Plannotator. Not the default editor for `.md` files.

Atomic Editor stays the writing engine. We theme and host it; we do not replace it.
