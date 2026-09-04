export const SELECTION_FORMAT_ACTIONS = ['bold', 'italic', 'strike', 'inlineCode', 'link'] as const;

export interface SelectionBarFlags {
  readOnly: boolean;
  selectionEmpty: boolean;
  /** CM `hasFocus` — may flicker false after a mouse selection in a webview. */
  editorFocused: boolean;
  pointerOnBar: boolean;
  /** `document.activeElement` is inside `.cm-editor`. */
  editorDomActive: boolean;
}

export interface SelectionAnchor {
  top: number;
  bottom: number;
  left: number;
  right: number;
}

export interface SelectionBarBox {
  top: number;
  left: number;
}

export const SELECTION_BAR_GAP_PX = 8;
export const SELECTION_BAR_EDGE_PX = 8;
export const SELECTION_BAR_FALLBACK_WIDTH = 176;
export const SELECTION_BAR_FALLBACK_HEIGHT = 32;

/**
 * Show for any non-empty edit-mode selection unless focus has clearly left
 * the editor (outline, notice, …) and is not on the bar.
 * `hasFocus` alone must not hide the bar after a mouse selection.
 */
export function shouldShowSelectionBar(input: SelectionBarFlags): boolean {
  if (input.readOnly || input.selectionEmpty) {
    return false;
  }
  return input.editorFocused || input.editorDomActive || input.pointerOnBar;
}

/** Treat body/html/null as a webview focus flicker, not a real leave. */
export function editorInteractionActive(input: {
  hasFocus: boolean;
  pointerOnBar: boolean;
  activeInsideEditor: boolean;
  activeInsideBar: boolean;
  activeNodeName?: string | null;
}): boolean {
  if (input.hasFocus || input.pointerOnBar || input.activeInsideEditor || input.activeInsideBar) {
    return true;
  }
  const name = input.activeNodeName?.toUpperCase();
  return !name || name === 'BODY' || name === 'HTML';
}

export function asSelectionAnchor(rect: Partial<SelectionAnchor> | null | undefined): SelectionAnchor | null {
  if (!rect) {
    return null;
  }
  const { top, bottom, left, right } = rect;
  if (
    typeof top !== 'number' ||
    typeof bottom !== 'number' ||
    typeof left !== 'number' ||
    typeof right !== 'number' ||
    ![top, bottom, left, right].every(Number.isFinite)
  ) {
    return null;
  }
  return { top, bottom, left, right };
}

export function readCoordsAtPos(
  coordsAtPos: (pos: number, side?: -1 | 1) => Partial<SelectionAnchor> | null | undefined,
  pos: number,
  preferSide: -1 | 1,
): SelectionAnchor | null {
  return (
    asSelectionAnchor(coordsAtPos(pos, preferSide)) ??
    asSelectionAnchor(coordsAtPos(pos, preferSide === 1 ? -1 : 1)) ??
    asSelectionAnchor(coordsAtPos(pos))
  );
}

export function domSelectionAnchor(
  selection: { rangeCount: number; isCollapsed: boolean; getRangeAt(index: number): { commonAncestorContainer: Node; getBoundingClientRect(): DOMRect } } | null,
  editorRoot: Node | null,
): SelectionAnchor | null {
  if (!selection || selection.rangeCount === 0 || selection.isCollapsed) {
    return null;
  }
  const range = selection.getRangeAt(0);
  if (editorRoot && !nodeIsInside(editorRoot, range.commonAncestorContainer)) {
    return null;
  }
  return asSelectionAnchor(range.getBoundingClientRect());
}

function nodeIsInside(root: Node, node: Node): boolean {
  if (root === node) {
    return true;
  }
  if (typeof root.contains === 'function') {
    return root.contains(node);
  }
  return false;
}

export function resolveSelectionAnchors(input: {
  start: SelectionAnchor | null;
  end: SelectionAnchor | null;
  domFallback: SelectionAnchor | null;
}): { start: SelectionAnchor; end: SelectionAnchor } | null {
  if (input.start && input.end) {
    return { start: input.start, end: input.end };
  }
  if (input.start && input.domFallback) {
    return { start: input.start, end: input.domFallback };
  }
  if (input.end && input.domFallback) {
    return { start: input.domFallback, end: input.end };
  }
  if (input.domFallback) {
    return { start: input.domFallback, end: input.domFallback };
  }
  return null;
}

export function placeSelectionBar(
  anchor: SelectionAnchor,
  viewport: { width: number; height: number },
  bar: { width: number; height: number },
  gap = SELECTION_BAR_GAP_PX,
): SelectionBarBox {
  const width = Math.max(1, bar.width);
  const height = Math.max(1, bar.height);
  const midX = (anchor.left + anchor.right) / 2;
  const maxLeft = Math.max(SELECTION_BAR_EDGE_PX, viewport.width - width - SELECTION_BAR_EDGE_PX);
  let left = midX - width / 2;
  left = Math.min(maxLeft, Math.max(SELECTION_BAR_EDGE_PX, left));

  let top = anchor.top - height - gap;
  if (top < SELECTION_BAR_EDGE_PX) {
    top = anchor.bottom + gap;
  }
  const maxTop = Math.max(SELECTION_BAR_EDGE_PX, viewport.height - height - SELECTION_BAR_EDGE_PX);
  top = Math.min(maxTop, Math.max(SELECTION_BAR_EDGE_PX, top));
  return { top, left };
}

export function selectionBarFromCoords(
  flags: SelectionBarFlags,
  start: SelectionAnchor | null,
  end: SelectionAnchor | null,
  viewport: { width: number; height: number },
  bar: { width: number; height: number },
  domFallback: SelectionAnchor | null = null,
): SelectionBarBox | null {
  if (!shouldShowSelectionBar(flags)) {
    return null;
  }
  const anchors = resolveSelectionAnchors({ start, end, domFallback });
  if (!anchors) {
    return null;
  }
  return placeSelectionBar(
    {
      top: Math.min(anchors.start.top, anchors.end.top),
      bottom: Math.max(anchors.start.bottom, anchors.end.bottom),
      left: Math.min(anchors.start.left, anchors.end.left),
      right: Math.max(anchors.start.right, anchors.end.right),
    },
    viewport,
    bar,
  );
}

export function isSelectionRefreshKey(key: string, shiftKey: boolean): boolean {
  return (
    shiftKey ||
    key === 'Shift' ||
    key === 'Home' ||
    key === 'End' ||
    key.startsWith('Arrow') ||
    key === 'PageUp' ||
    key === 'PageDown'
  );
}
