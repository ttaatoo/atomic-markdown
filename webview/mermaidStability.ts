import { selectionTouchesRange } from './mermaidFences.ts';

/**
 * Occupancy key: which mermaid fences currently hold the caret/selection.
 * Used so decoration rebuilds happen only when replace↔preview would change,
 * not on every caret move (which remounted widgets and thrashed layout).
 */
export function mermaidFenceOccupancy(
  fences: ReadonlyArray<{ from: number; to: number }>,
  ranges: ReadonlyArray<{ from: number; to: number }>,
  readOnly: boolean,
): string {
  if (readOnly) {
    return 'ro';
  }
  return fences.map((fence) => (selectionTouchesRange(ranges, fence.from, fence.to) ? '1' : '0')).join('');
}

export function mermaidDecorationsShouldRebuild(input: {
  docChanged: boolean;
  themeChanged: boolean;
  readOnlyChanged: boolean;
  occupancyChanged: boolean;
}): boolean {
  return input.docChanged || input.themeChanged || input.readOnlyChanged || input.occupancyChanged;
}

/** Stable identity for widget `eq` / DOM reuse across viewport remounts. */
export function mermaidWidgetReuseKey(source: string, theme: string, clickToEdit: boolean): string {
  return `${theme}\0${clickToEdit ? '1' : '0'}\0${source}`;
}

/**
 * Mermaid often emits width/height="100%" (and style height:100%). Inside a
 * CM6 block widget whose height is itself inferred from the SVG, that cycle
 * oscillates estimatedHeight, forces requestMeasure storms, and can collapse
 * the scroller — html/body then show as a solid gray panel.
 */
export function normalizeMermaidSvgElement(svg: {
  getAttribute(name: string): string | null;
  removeAttribute(name: string): void;
  style: { width: string; height: string; maxWidth: string; display: string };
}): void {
  const width = svg.getAttribute('width');
  const height = svg.getAttribute('height');
  if (width === '100%' || width === '100') {
    svg.removeAttribute('width');
  }
  if (height === '100%' || height === '100') {
    svg.removeAttribute('height');
  }
  if (svg.style.width === '100%') {
    svg.style.width = '';
  }
  if (svg.style.height === '100%') {
    svg.style.height = 'auto';
  }
  svg.style.maxWidth = '100%';
  svg.style.height = svg.style.height || 'auto';
  svg.style.display = 'block';
}

export function shouldUpdateMermaidHeightCache(
  previous: number | undefined,
  next: number,
): boolean {
  if (!Number.isFinite(next) || next <= 0) {
    return false;
  }
  if (previous === undefined) {
    return true;
  }
  return Math.abs(next - previous) >= 2;
}

/** Skip a second mermaid.render when this DOM already shows this source+theme. */
export function mermaidDomAlreadyRendered(
  dataset: { mermaidRendered?: string },
  key: string,
): boolean {
  return dataset.mermaidRendered === key;
}
