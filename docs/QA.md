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
- Plannotator token mapping, writing-surface CSS contracts, and Inter/Geist latin font bundling

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
    **Verify:** Scroll a multi-mermaid doc — toolbar/editor stay mounted. Invalid mermaid still shows `role=alert`. Toggle light/dark — diagrams re-render.

10. **Image paste / drop**  
    Save the markdown file. Paste a PNG from the clipboard; confirm `assets/` (or configured dir) gets a unique file and `![](./assets/…)` is inserted at the caret. Undo removes the markdown link (file on disk may remain). Drop a `.jpg`. Untitled unsaved buffer: error toast, clipboard unchanged.

11. **Toolbar / shortcuts**  
    Cmd/Ctrl+B / I / K wrap selection. Heading button cycles H1–H3. Icons (not letter glyphs) and pressed state when the caret is already in that mark. Hide toolbar via `atomicMarkdown.toolbar.enabled`. Confirm Cmd/Ctrl+S still saves (not hijacked). Format buttons stay disabled in reading mode.

11b. **Open with Atomic replaces the tab**  
    Open `welcome.md` in the default text editor. Command Palette / title icon → **Open with Atomic Markdown**. The text tab should become Atomic (same tab slot), not a second same-named tab. Explorer context on a `.md` that is already open as text should also reopen in place. **Reopen Editor With… → Text Editor** still works.

11c. **Find / Escape**  
    With Atomic focused, Cmd/Ctrl+F must open Atomic’s in-editor find (not the workbench Search sidebar). Escape closes that find while it is open and does nothing special when it is closed. Title search icon still calls `atomicMarkdown.find` → `openSearch`.

12. **Theme / typography**  
    With `atomicMarkdown.theme` = `followVscode`, the title **color-mode** icon is visible. Toggle writes explicit opposite light/dark. Change `fontSize` / `contentWidth` in settings: scroll position and CM instance remain (no remount flash). Empty `fontFamily` should render Inter / Geist Mono (not the workbench UI font). Glance: ~70ch centered prose, heading size steps, primary quote rail, rounded/muted tables, primary-tinted selection, outline card + current-heading wash, obvious Reading pill.

13. **Outline**  
    Wide window: outline visible with nested headings. After jumping to **Tables**, wheel-scroll until **Fences** is at the top: the outline highlight must move to Fences (scroll-driven, not stuck on the click/caret). Click jumps and (edit mode) moves caret. Reading mode: scroll/reveal without needing to expose source. Empty note: styled “No headings”. Toggle from title and toolbar. Setting `atomicMarkdown.outline.enabled` false hides it. Narrow (~640px) layout hides the rail so the editor is not crushed. Document is never given a `[TOC]` block.

13b. **Reading mode**  
    Toggle reading mode: title icon switches book ↔ pencil, and the webview shows a **Reading** chip. Format buttons stay disabled. Theme toggle remains visible in `followVscode`.

14. **Disposals**  
    Open Atomic, close, open again on the same file several times. No duplicate image inserts per paste, no stuck generation.
