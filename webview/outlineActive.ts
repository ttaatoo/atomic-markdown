export interface OutlineNavHeading {
  from: number;
}

/**
 * Heading at or before `pos` (visible viewport top). Hierarchical outline
 * stays as-is; this only picks which entry is "current".
 */
export function activeOutlineHeadingFrom(
  headings: readonly OutlineNavHeading[],
  pos: number,
): number | undefined {
  let found: number | undefined;
  for (const heading of headings) {
    if (heading.from <= pos) {
      found = heading.from;
    } else {
      break;
    }
  }
  return found;
}

/** Heading whose source offset is at or above the visible scroll position. */
export function headingAtScrollPosition(
  headings: readonly OutlineNavHeading[],
  visibleTopPos: number,
): number | undefined {
  return activeOutlineHeadingFrom(headings, visibleTopPos);
}

/**
 * Scroll-driven: always the visible viewport top.
 * A leftover caret (outline click, then wheel-scroll) must not pin the highlight.
 */
export function outlineNavOffset(input: { viewportFrom: number; caret: number }): number {
  void input.caret;
  return input.viewportFrom;
}

/** Map scroller offset onto a document position using line-block geometry. */
export function docPosAtScrollTop(
  scrollTop: number,
  blocks: readonly { from: number; top: number }[],
): number {
  let found = blocks[0]?.from ?? 0;
  for (const block of blocks) {
    if (block.top <= scrollTop) {
      found = block.from;
    } else {
      break;
    }
  }
  return found;
}

export interface VisibleTopView {
  scrollDOM: {
    scrollTop: number;
    getBoundingClientRect(): { left: number; top: number; right: number; height: number };
  };
  contentDOM: {
    getBoundingClientRect(): { left: number; top: number; right: number };
  };
  posAtCoords(coords: { x: number; y: number }, precise?: boolean): number | null;
  lineBlockAtHeight(height: number): { from: number };
  viewport: { from: number };
  documentPadding?: { top: number };
}

/**
 * Document position at the visible top of the scroller.
 * Uses posAtCoords(..., false) so a centered 70ch column still resolves
 * (precise=true returns null in the side padding and we used to fall back
 * to CM6's overscan viewport.from, which lags behind the visible heading).
 */
export function visibleTopDocPos(view: VisibleTopView): number {
  const scrollRect = view.scrollDOM.getBoundingClientRect();
  const contentRect = view.contentDOM.getBoundingClientRect();
  const left = Math.max(scrollRect.left, contentRect.left);
  const right = Math.min(scrollRect.right, contentRect.right);
  const x = left + Math.max(1, Math.min(16, (right - left) / 2));
  const y = scrollRect.top + 8;
  const pos = view.posAtCoords({ x, y }, false);
  if (typeof pos === 'number' && pos >= 0) {
    return pos;
  }
  try {
    const pad = view.documentPadding?.top ?? 0;
    return view.lineBlockAtHeight(view.scrollDOM.scrollTop + pad).from;
  } catch {
    return view.viewport.from;
  }
}
