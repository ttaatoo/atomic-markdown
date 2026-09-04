export interface OutlineNavHeading {
  from: number;
}

/**
 * Heading at or before `pos` (caret or viewport top). Hierarchical outline
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

/** Prefer the caret when it is on-screen; otherwise the viewport top. */
export function outlineNavOffset(input: {
  viewportFrom: number;
  caret: number;
  caretInView: boolean;
}): number {
  return input.caretInView ? input.caret : input.viewportFrom;
}

export function caretInViewport(caret: number, viewportFrom: number, viewportTo: number): boolean {
  return caret >= viewportFrom && caret <= viewportTo;
}
