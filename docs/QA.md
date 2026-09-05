# Atomic Markdown manual QA (F5)

Unit tests cover sync planning, EOL, outline parsing, image path generation, formatting transforms, and mermaid **fence** parsing. They do **not** host a VS Code window. Use this checklist in an Extension Development Host (**F5**).

Do not treat an item as automated unless it is listed under “Covered by unit tests” below.

## Covered by unit tests (CI / `npm test`)

- Stale vs newer webview generations (`planWebviewEdit`); overlapping generations drop the earlier one
- Echo vs non-echo document changes, including an undo-shaped revert (`isEchoDocumentChange('old', 'new') === false`)
- Versioned one-shot echo tickets (A→B local then external B→A is not ignored)
- Pre-`applyEdit` version/text guard aborts and catch-up when the document moved
- `applyEdit === false` catch-up and concurrent document mismatch
- Multiple sessions per URI and forwarding to the non-writer (`sessionMap`)
- LF/CRLF round-trip, including a generated ~1–1.5 MB string (not a committed fixture)
- Large-document `planWebviewEdit` replace
- Image directory traversal rejection, collisions, mime → extension, untitled error string
- Format wrap/unwrap, link, heading cycle, lists, snippet insert
- Outline ATX/setext, `#` inside fences, duplicates, skipped levels, empty state, debounce helper
- Invalid mermaid fence **body remains in the markdown**; `mermaidErrorMessage` shaping
- Mermaid decoration rebuild gating (occupancy, not every caret move), SVG 100% normalize, height-cache hysteresis
- Open-with-Atomic replace vs stack planner
- Toolbar format-active detection; outline heading-at-scroll-position (not leftover caret); find Ctrl/F + Escape routing and package.json when clauses
- Appearance clamps and CSS variable apply/remove
- Plannotator token mapping (exact dark/light oklch, no theme-follow mute), writing-surface CSS contracts, and optional Inter/Geist latin font bundling
- Feishu outline placement (push rail / icon rail / last-resort overlay), nested heading collapse + prune, YAML frontmatter / thematic-break `---` excluded from headings; no top Format strip; CM `showTooltip` Comment / Global comment / Copy stack (no format icons); chat prompt builder (empty comment + global fence/path-only) and `sendToChat` / `copyText` protocol; image failure copy

**Not** covered in CI: `mermaid.render` of invalid diagrams, VS Code `WorkspaceEdit` undo stack, real clipboard paste, two live webview panels, listener leaks under the VS Code host, or the full mermaid-scroll renderer path (see below).

## F5 checklist

1. **Open / reopen**  
   Open `samples/welcome.md` with Atomic Markdown. Close the tab, reopen. Type; the tab goes dirty. Save. Close and reopen: listeners still work (no duplicate echo / frozen editor).

2. **Undo / redo**  
   In Atomic, type a word. **Cmd/Ctrl+Z** in the webview should undo in CM and sync to the document.  
   Split a **text editor** on the same file, type in Atomic, then undo **in the text editor**: Atomic should catch up (non-echo document change). Redo in the text editor should re-apply.  
   *(Host undo stack is not unit-tested here.)*

3. **External change**  
   With Atomic open, edit the same file in the text editor or simulate a disk change and revert. Atomic should update without duplicating the writer’s own keystrokes.

4. **Rapid typing**  
   Type quickly, toggle a checkbox, undo. The document should not rewind to a stale generation.

5. **Two custom panels**  
   `Reopen Editor With` / split Atomic on the same `.md`. Type in one: the other should follow. Undo in one panel’s CM history is local to that CM view until it syncs through the document.

6. **Text + custom**  
   Keep default text editor + Atomic. Edits in either side should meet in the `TextDocument`.

7. **LF / CRLF**  
   Open a CRLF file, type a line, save, and confirm git/diff does not rewrite the whole file to LF.

8. **Large markdown**  
   Paste or generate a ~1 MB note. Outline should still update (debounced). Typing should remain usable. *(CI generates a large string for EOL/sync helpers only.)*

9. **Invalid mermaid**  
   Insert ` ```mermaid ` / `not a diagram` / ` ``` `. Preview shows an inline error (`role=alert`). Click the widget (edit mode) to put the caret in the fence; the source remains. Valid mermaid still renders SVG.  
   *(Rendering is not executed in `npm test`.)*

9b. **Mermaid scroll stability (gray-blank regression)**  
    **Repro (before the fix):** Open a long `.md` with several mermaid fences separated by headings (welcome.md plus extra flowcharts is enough). Open with Atomic. Scroll through the mermaid sections with the wheel/trackpad. Failure: the webview became a solid Plannotator gray panel (html/body background). Other Atomic tabs stayed blank until **Developer: Reload Window**.  
    **Root cause:** Mermaid `Decoration.replace` widgets remounted on every selection change and on viewport enter/leave. `toDOM` applied SVG then called `getBoundingClientRect` + `view.requestMeasure()` during CM6 DOM updates. Mermaid SVGs often ship `width/height="100%"`, which with CM6 `estimatedHeight` oscillated and could collapse the scroller. An uncaught exception or renderer hang in that loop tore down the React tree; `html.theme-plannotator` stayed gray. The shared webview renderer made it look like every document died.  
    **Fix:** Rebuild mermaid decorations only when doc/theme/readOnly/fence-occupancy changes; reuse widgets via `eq`; apply cached SVG without a synchronous measure when height is already known; normalize 100% SVG dimensions; isolate mermaid exceptions. Theme still uses a `StateEffect` (no dummy doc change) so diagrams re-theme.  
    **Verify:** Scroll a multi-mermaid doc — editor stays mounted. Invalid mermaid still shows `role=alert`. Toggle light/dark — diagrams re-render.

10. **Image paste / drop**  
    Save the markdown file. Paste a PNG from the clipboard; confirm `assets/` (or configured dir) gets a unique file and `![](./assets/…)` is inserted at the caret. Undo removes the markdown link (file on disk may remain). Drop a `.jpg`. Untitled unsaved buffer: inline notice plus host error, clipboard unchanged. A write failure shows “Couldn't save image to assets/…” in the webview.

11. **Selection comment stack / shortcuts**  
    There must be **no** top Format strip, Reading chip, or outline toggle in the webview. Select the plain sentence **“Raw markdown is the source of truth.”** (not `==highlights==` — that mark decoration is purple, not a CM selection). A CodeMirror tooltip (`.cm-tooltip.selection-format-bar`) **must** appear with **Comment** / **Global comment** / **Copy** pills and an open comment card (quoted selection, expand, close). There are **no** B/I/S/code/link buttons and no separate **Add to Chat**. **Send** stays enabled with an empty textarea — click it and Cursor Chat opens with `File: …:line-line` and a fenced copy of the sentence (no `Comment:` line). Type a note and **Send** — the prompt includes `Comment: …`. **Global comment** switches the card title/placeholder; **Add** / **Send** builds a file-level prompt (fenced body when the doc is small). **Copy** copies the selection (pill shows Copied) and does not open chat. Escape or **X** dismisses the stack. Collapse the selection: the menu disappears. Reading mode still shows the stack if a selection exists. Cmd/Ctrl+B / I / K still wrap with no format icons on the bar. Confirm Cmd/Ctrl+S still saves (not hijacked). Heading/list formats remain available via **Format Selection**.

11b. **Open with Atomic replaces the tab**  
    Open `welcome.md` in the default text editor. Command Palette / title icon → **Open with Atomic Markdown**. The text tab should become Atomic (same tab slot), not a second same-named tab. Explorer context on a `.md` that is already open as text should also reopen in place. **Reopen Editor With… → Text Editor** still works.

11c. **Find / Escape**  
    With Atomic focused, Cmd/Ctrl+F must open Atomic’s in-editor find (not the workbench Search sidebar). Escape closes that find while it is open and does nothing special when it is closed. Title search icon still calls `atomicMarkdown.find` → `openSearch`.

12. **Theme / typography**  
    With `atomicMarkdown.theme` = `followVscode`, the title **color-mode** icon is visible. Toggle writes explicit opposite light/dark. The canvas must use Plannotator’s exact dark or light tokens (saturated primary/accent), not VS Code editor background. Change `fontSize` / `contentWidth` in settings: scroll position and CM instance remain (no remount flash). Empty `fontFamily` / unset `fontSize` must match the workbench / editor font (Explorer/tabs), not bundled Inter. Glance: ~70ch centered prose, heading size steps, primary quote rail, rounded/muted tables, primary-tinted selection, outline card + current-heading wash. No top chrome strip.

13. **Outline**  
    Wide window: outline visible as a **push rail** (writing column shrinks; prose is not covered). Nested headings have twisties; collapse a parent and reload is not required — state lasts the session. After jumping to **Tables**, wheel-scroll until **Fences** is at the top: the outline highlight must move to Fences (scroll-driven, not stuck on the click/caret). Click jumps and (edit mode) moves caret. Reading mode: scroll/reveal without needing to expose source. Empty note: teaching empty state. Toggle only from the panel chevron/icon rail (and the host **Toggle Outline** command) — there is no webview top-bar outline control. Collapse to the thin icon rail and expand again without losing caret/scroll. Setting `atomicMarkdown.outline.enabled` false hides it. Frontmatter in welcome.md must not appear in the outline. Document is never given a `[TOC]` block.  
    **Push, not overlay, at normal narrow widths:** shrink the Atomic editor group to ~350–500px. Open outline. The writing column must **shrink** beside the rail (not stay full-width under a drawer). Toggle Show/Hide both ways.  
    **Last-resort overlay:** only when the frame is extremely narrow (≤240px) may the expanded TOC float over the prose. Escape (when find is closed) or backdrop click then collapses to the icon rail.

13b. **Reading mode**  
    Toggle reading mode: title icon switches book ↔ pencil. The webview must **not** show a Reading chip or any top strip. Selecting text still shows the Comment / Global comment / Copy stack (no format icons). Theme toggle remains in the editor title.

14. **Disposals**  
    Open Atomic, close, open again on the same file several times. No duplicate image inserts per paste, no stuck generation.
