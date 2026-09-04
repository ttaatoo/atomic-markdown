export const SELECTION_FORMAT_ACTIONS = ['bold', 'italic', 'strike', 'inlineCode', 'link'] as const;

export interface SelectionBarFlags {
  readOnly: boolean;
  selectionEmpty: boolean;
  /**
   * True only when focus is on a real control outside the editor/bar
   * (outline button, notice dismiss, …). Body/html flicker is not this.
   */
  focusOnForeignChrome: boolean;
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

/** Last-resort box so a non-empty edit selection always mounts a bar. */
export const SAFE_DEFAULT_ANCHOR: SelectionAnchor = {
  top: 48,
  bottom: 72,
  left: 96,
  right: 280,
};

/**
 * Non-empty edit-mode selection always shows the bar unless focus is
 * clearly on foreign chrome. Coords never participate in this gate.
 */
export function shouldShowSelectionBar(input: SelectionBarFlags): boolean {
  if (input.readOnly || input.selectionEmpty || input.focusOnForeignChrome) {
    return false;
  }
  return true;
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
  if (right - left + (bottom - top) < 0.5) {
    return null;
  }
  return { top, bottom, left, right };
}

export function unionAnchors(rects: readonly SelectionAnchor[]): SelectionAnchor | null {
  if (rects.length === 0) {
    return null;
  }
  return {
    top: Math.min(...rects.map((r) => r.top)),
    bottom: Math.max(...rects.map((r) => r.bottom)),
    left: Math.min(...rects.map((r) => r.left)),
    right: Math.max(...rects.map((r) => r.right)),
  };
}

export function readCoordsAtPos(
  coordsAtPos: (pos: number, side?: -1 | 1) => Partial<SelectionAnchor> | null | undefined,
  pos: number,
  preferSide: -1 | 1,
): SelectionAnchor | null {
  return (
    safeCallCoords(coordsAtPos, pos, preferSide) ??
    safeCallCoords(coordsAtPos, pos, preferSide === 1 ? -1 : 1) ??
    safeCallCoords(coordsAtPos, pos)
  );
}

function safeCallCoords(
  coordsAtPos: (pos: number, side?: -1 | 1) => Partial<SelectionAnchor> | null | undefined,
  pos: number,
  side?: -1 | 1,
): SelectionAnchor | null {
  try {
    return asSelectionAnchor(side === undefined ? coordsAtPos(pos) : coordsAtPos(pos, side));
  } catch {
    return null;
  }
}

export function selectionLayerAnchor(
  root: { querySelectorAll(selector: string): ArrayLike<Element> } | null,
): SelectionAnchor | null {
  if (!root || typeof root.querySelectorAll !== 'function') {
    return null;
  }
  const nodes = root.querySelectorAll('.cm-selectionBackground, .cm-selectionLayer > *');
  const rects: SelectionAnchor[] = [];
  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i] as Element & {
      getClientRects?: () => ArrayLike<DOMRect>;
      getBoundingClientRect?: () => DOMRect;
    };
    if (typeof node.getClientRects === 'function') {
      const list = node.getClientRects();
      for (let j = 0; j < list.length; j++) {
        const box = asSelectionAnchor(list[j]);
        if (box) {
          rects.push(box);
        }
      }
    } else if (typeof node.getBoundingClientRect === 'function') {
      const box = asSelectionAnchor(node.getBoundingClientRect());
      if (box) {
        rects.push(box);
      }
    }
  }
  return unionAnchors(rects);
}

export function anchorFromDomPositions(
  start: { node: Node; offset: number } | null | undefined,
  end: { node: Node; offset: number } | null | undefined,
  createRange: () => {
    setStart(node: Node, offset: number): void;
    setEnd(node: Node, offset: number): void;
    getBoundingClientRect(): DOMRect;
    getClientRects(): ArrayLike<DOMRect>;
  },
): SelectionAnchor | null {
  if (!start || !end) {
    return null;
  }
  try {
    const range = createRange();
    range.setStart(start.node, start.offset);
    range.setEnd(end.node, end.offset);
    return asSelectionAnchor(range.getBoundingClientRect()) ?? unionAnchors(
      Array.from(range.getClientRects(), (r) => asSelectionAnchor(r)).filter((r): r is SelectionAnchor => r !== null),
    );
  } catch {
    return null;
  }
}

export function contentDefaultAnchor(rect: Partial<SelectionAnchor> | null | undefined): SelectionAnchor | null {
  const box = asSelectionAnchor(rect);
  if (!box) {
    return null;
  }
  const mid = (box.left + box.right) / 2;
  return {
    top: box.top + 8,
    bottom: Math.min(box.bottom, box.top + 28),
    left: mid - 40,
    right: mid + 40,
  };
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
  fallbacks?: Array<SelectionAnchor | null>;
  /** @deprecated use fallbacks */
  domFallback?: SelectionAnchor | null;
}): { start: SelectionAnchor; end: SelectionAnchor } | null {
  const extras = [...(input.fallbacks ?? []), input.domFallback ?? null].filter((a): a is SelectionAnchor => a !== null);
  if (input.start && input.end) {
    return { start: input.start, end: input.end };
  }
  if (input.start && extras[0]) {
    return { start: input.start, end: extras[0] };
  }
  if (input.end && extras[0]) {
    return { start: extras[0], end: input.end };
  }
  if (extras[0]) {
    return { start: extras[0], end: extras[0] };
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

export function selectionBarFromSources(input: {
  flags: SelectionBarFlags;
  start: SelectionAnchor | null;
  end: SelectionAnchor | null;
  fallbacks?: Array<SelectionAnchor | null>;
  viewport: { width: number; height: number };
  bar: { width: number; height: number };
}): SelectionBarBox | null {
  if (!shouldShowSelectionBar(input.flags)) {
    return null;
  }
  const pair = resolveSelectionAnchors({
    start: input.start,
    end: input.end,
    fallbacks: input.fallbacks,
  });
  const fallback = (input.fallbacks ?? []).find((a): a is SelectionAnchor => a !== null);
  const anchor = pair
    ? {
        top: Math.min(pair.start.top, pair.end.top),
        bottom: Math.max(pair.start.bottom, pair.end.bottom),
        left: Math.min(pair.start.left, pair.end.left),
        right: Math.max(pair.start.right, pair.end.right),
      }
    : fallback ?? SAFE_DEFAULT_ANCHOR;
  return placeSelectionBar(anchor, input.viewport, input.bar);
}

export function selectionBarFromCoords(
  flags: SelectionBarFlags,
  start: SelectionAnchor | null,
  end: SelectionAnchor | null,
  viewport: { width: number; height: number },
  bar: { width: number; height: number },
  ...fallbacks: Array<SelectionAnchor | null>
): SelectionBarBox | null {
  return selectionBarFromSources({ flags, start, end, fallbacks, viewport, bar });
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
