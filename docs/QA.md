# Atomic Markdown manual QA (F5)

Unit tests cover sync planning, EOL, outline parsing, image path generation, formatting transforms, and mermaid **fence** parsing. They do **not** host a VS Code window. Use this checklist in an Extension Development Host (**F5**).

Do not treat an item as automated unless it is listed under “Covered by unit tests” below.

## Covered by unit tests (CI / `npm test`)

- Stale vs newer webview generations (`planWebviewEdit`); overlapping generations drop the earlier one
- Echo vs non-echo document changes, including an undo-shaped revert (`isEchoDocumentChange('old', 'new') === false`)
- `applyEdit === false` catch-up and concurrent document mismatch
- Multiple sessions per URI and forwarding to the non-writer (`sessionMap`)
- LF/CRLF round-trip, including a generated ~1–1.5 MB string (not a committed fixture)
- Large-document `planWebviewEdit` replace
- Image directory traversal rejection, collisions, mime → extension, untitled error string
- Format wrap/unwrap, link, heading cycle, lists, snippet insert
- Outline ATX/setext, `#` inside fences, duplicates, skipped levels, empty state, debounce helper
- Invalid mermaid fence **body remains in the markdown**; `mermaidErrorMessage` shaping
- Appearance clamps and CSS variable apply/remove

**Not** covered in CI: `mermaid.render` of invalid diagrams, VS Code `WorkspaceEdit` undo stack, real clipboard paste, two live webview panels, or listener leaks under the VS Code host.

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

10. **Image paste / drop**  
    Save the markdown file. Paste a PNG from the clipboard; confirm `assets/` (or configured dir) gets a unique file and `![](./assets/…)` is inserted at the caret. Undo removes the markdown link (file on disk may remain). Drop a `.jpg`. Untitled unsaved buffer: error toast, clipboard unchanged.

11. **Toolbar / shortcuts**  
    Cmd/Ctrl+B / I / K wrap selection. Heading button cycles H1–H3. Hide toolbar via `atomicMarkdown.toolbar.enabled`. Confirm Cmd/Ctrl+S still saves (not hijacked).

12. **Theme / typography**  
    With `atomicMarkdown.theme` = `followVscode`, the title **color-mode** icon is visible. Toggle writes explicit opposite light/dark. Change `fontSize` / `contentWidth` in settings: scroll position and CM instance remain (no remount flash).

13. **Outline**  
    Wide window: outline visible with nested headings. Click jumps and (edit mode) moves caret. Reading mode: scroll/reveal without needing to expose source. Empty note: “No headings”. Toggle from title and toolbar. Setting `atomicMarkdown.outline.enabled` false hides it. Document is never given a `[TOC]` block.

14. **Disposals**  
    Open Atomic, close, open again on the same file several times. No duplicate image inserts per paste, no stuck generation.
