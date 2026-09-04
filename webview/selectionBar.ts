export const SELECTION_FORMAT_ACTIONS = ['bold', 'italic', 'strike', 'inlineCode', 'link'] as const;

export interface SelectionBarFlags {
  readOnly: boolean;
  selectionEmpty: boolean;
  editorFocused: boolean;
  pointerOnBar: boolean;
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

/** Show only for a non-empty edit-mode selection while the editor or the bar has the pointer/focus. */
export function shouldShowSelectionBar(input: SelectionBarFlags): boolean {
  if (input.readOnly || input.selectionEmpty) {
    return false;
  }
  return input.editorFocused || input.pointerOnBar;
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
): SelectionBarBox | null {
  if (!shouldShowSelectionBar(flags) || !start || !end) {
    return null;
  }
  return placeSelectionBar(
    {
      top: Math.min(start.top, end.top),
      bottom: Math.max(start.bottom, end.bottom),
      left: Math.min(start.left, end.left),
      right: Math.max(start.right, end.right),
    },
    viewport,
    bar,
  );
}
