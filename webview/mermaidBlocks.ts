import { readOnlyFacet } from '@atomic-editor/editor';
import { EditorState, StateEffect, StateField, type Extension } from '@codemirror/state';
import { Decoration, EditorView, ViewPlugin, WidgetType, type DecorationSet } from '@codemirror/view';
import {
  findMermaidFenceRangesInDoc,
  mermaidThemeFromDom,
  planMermaidDecorationsFromFences,
  type MermaidTheme,
} from './mermaidFences';
import { mermaidErrorBoundary } from './mermaidIsolation';
import { cachedMermaidResult, renderMermaidSvg, type MermaidRenderResult } from './mermaidRender';
import {
  mermaidDecorationsShouldRebuild,
  mermaidDomAlreadyRendered,
  mermaidFenceOccupancy,
  mermaidWidgetReuseKey,
  normalizeMermaidSvgElement,
  shouldUpdateMermaidHeightCache,
} from './mermaidStability';

const mermaidThemeEffect = StateEffect.define<MermaidTheme>();

const mermaidThemeField = StateField.define<MermaidTheme>({
  create: () => currentMermaidTheme(),
  update(value, tr) {
    for (const effect of tr.effects) {
      if (effect.is(mermaidThemeEffect)) {
        return effect.value;
      }
    }
    return value;
  },
});

const mermaidThemeWatcher = ViewPlugin.fromClass(
  class {
    private readonly observer: MutationObserver | undefined;

    constructor(view: EditorView) {
      if (typeof MutationObserver === 'undefined' || typeof document === 'undefined') {
        return;
      }
      this.observer = new MutationObserver(() => {
        const theme = currentMermaidTheme();
        if (theme !== view.state.field(mermaidThemeField)) {
          // Theme only — no dummy document change. Widgets remount via eq().
          view.dispatch({ effects: mermaidThemeEffect.of(theme) });
        }
      });
      this.observer.observe(document.documentElement, {
        attributes: true,
        attributeFilter: ['data-theme'],
      });
    }

    destroy(): void {
      this.observer?.disconnect();
    }
  },
);

const heightCache = new Map<string, number>();

class MermaidWidget extends WidgetType {
  source: string;
  theme: MermaidTheme;
  clickToEdit: boolean;
  fenceFrom: number;
  private aborted = false;
  private renderGen = 0;
  private timer: ReturnType<typeof setTimeout> | undefined;

  constructor(spec: {
    source: string;
    theme: MermaidTheme;
    clickToEdit: boolean;
    fenceFrom: number;
  }) {
    super();
    this.source = spec.source;
    this.theme = spec.theme;
    this.clickToEdit = spec.clickToEdit;
    this.fenceFrom = spec.fenceFrom;
  }

  eq(other: WidgetType): boolean {
    if (
      other instanceof MermaidWidget &&
      other.source === this.source &&
      other.theme === this.theme &&
      other.clickToEdit === this.clickToEdit
    ) {
      this.fenceFrom = other.fenceFrom;
      return true;
    }
    return false;
  }

  toDOM(view: EditorView): HTMLElement {
    return mermaidErrorBoundary(
      () => this.buildDom(view),
      () => fallbackMermaidDom('Diagram failed to render'),
    );
  }

  private buildDom(view: EditorView): HTMLElement {
    this.aborted = false;
    const wrap = document.createElement('div');
    const key = mermaidWidgetReuseKey(this.source, this.theme, this.clickToEdit);
    wrap.className = this.clickToEdit
      ? 'cm-atomic-mermaid cm-atomic-mermaid-clickable'
      : 'cm-atomic-mermaid';
    wrap.setAttribute('contenteditable', 'false');
    wrap.setAttribute('role', 'img');
    wrap.setAttribute('aria-label', 'Mermaid diagram');
    wrap.dataset.mermaidKey = key;

    const inner = document.createElement('div');
    inner.className = 'cm-atomic-mermaid-inner';
    wrap.appendChild(inner);

    if (this.clickToEdit) {
      wrap.addEventListener('mousedown', (event) => {
        event.preventDefault();
        event.stopPropagation();
        placeCaretInMermaidFence(view, this.fenceFrom);
      });
    }

    if (mermaidDomAlreadyRendered(wrap.dataset, key)) {
      return wrap;
    }

    const cached = cachedMermaidResult(this.source, this.theme);
    if (cached) {
      applyMermaidResult(wrap, inner, cached, view, this.source, this.theme, {
        measure: !heightCache.has(cacheKey(this.source, this.theme)),
      });
    } else {
      inner.classList.add('cm-atomic-mermaid-pending');
      inner.textContent = 'Rendering diagram…';
      this.timer = setTimeout(() => {
        this.timer = undefined;
        void this.runRender(wrap, inner, view);
      }, 50);
    }

    return wrap;
  }

  destroy(): void {
    this.aborted = true;
    this.renderGen += 1;
    if (this.timer !== undefined) {
      clearTimeout(this.timer);
      this.timer = undefined;
    }
  }

  ignoreEvent(event: Event): boolean {
    return event.type === 'mousedown' || event.type === 'click';
  }

  get estimatedHeight(): number {
    return heightCache.get(cacheKey(this.source, this.theme)) ?? 160;
  }

  private async runRender(
    wrap: HTMLElement,
    inner: HTMLElement,
    view: EditorView,
  ): Promise<void> {
    const gen = ++this.renderGen;
    const result = await renderMermaidSvg(this.source, this.theme);
    if (this.aborted || gen !== this.renderGen || !wrap.isConnected) {
      return;
    }
    applyMermaidResult(wrap, inner, result, view, this.source, this.theme, { measure: true });
  }
}

function fallbackMermaidDom(message: string): HTMLElement {
  const wrap = document.createElement('div');
  wrap.className = 'cm-atomic-mermaid';
  const inner = document.createElement('div');
  inner.className = 'cm-atomic-mermaid-inner';
  showMermaidError(inner, message);
  wrap.appendChild(inner);
  return wrap;
}

function applyMermaidResult(
  wrap: HTMLElement,
  inner: HTMLElement,
  result: MermaidRenderResult,
  view: EditorView,
  source: string,
  theme: MermaidTheme,
  options: { measure: boolean },
): void {
  mermaidErrorBoundary(
    () => {
      inner.classList.remove('cm-atomic-mermaid-pending');
      inner.replaceChildren();
      if (result.ok) {
        const svg = svgFromMarkup(result.svg);
        if (svg) {
          normalizeMermaidSvgElement(svg);
          inner.appendChild(svg);
        } else {
          showMermaidError(inner, 'Mermaid produced unreadable SVG');
        }
      } else {
        showMermaidError(inner, result.error);
      }
      wrap.dataset.mermaidRendered = mermaidWidgetReuseKey(source, theme, true);
      const key = cacheKey(source, theme);
      if (!options.measure && heightCache.has(key)) {
        return;
      }
      scheduleHeightMeasure(view, wrap, source, theme);
    },
    () => {
      showMermaidError(inner, 'Mermaid produced unreadable SVG');
    },
  );
}

function scheduleHeightMeasure(view: EditorView, wrap: HTMLElement, source: string, theme: MermaidTheme): void {
  const key = cacheKey(source, theme);
  const run = () => {
    if (!wrap.isConnected) {
      return;
    }
    const height = wrap.getBoundingClientRect().height;
    if (!shouldUpdateMermaidHeightCache(heightCache.get(key), height)) {
      return;
    }
    heightCache.set(key, height);
    try {
      view.requestMeasure();
    } catch {
      // Never throw out of a mermaid widget into CM6 / React.
    }
  };
  if (typeof requestAnimationFrame === 'function') {
    requestAnimationFrame(run);
  } else {
    setTimeout(run, 0);
  }
}

function showMermaidError(inner: HTMLElement, message: string): void {
  const error = document.createElement('div');
  error.className = 'cm-atomic-mermaid-error';
  error.setAttribute('role', 'alert');
  error.textContent = message;
  inner.appendChild(error);
}

function svgFromMarkup(markup: string): SVGElement | undefined {
  try {
    const parsed = new DOMParser().parseFromString(markup, 'image/svg+xml');
    const root = parsed.documentElement;
    if (!root || root.nodeName.toLowerCase() !== 'svg') {
      return undefined;
    }
    if (parsed.querySelector('parsererror')) {
      return undefined;
    }
    return document.importNode(root, true) as unknown as SVGElement;
  } catch {
    return undefined;
  }
}

function placeCaretInMermaidFence(view: EditorView, fenceFrom: number): void {
  const doc = view.state.doc;
  const openLine = doc.lineAt(Math.min(Math.max(0, fenceFrom), doc.length));
  const bodyLine = openLine.number < doc.lines ? doc.line(openLine.number + 1) : openLine;
  view.focus();
  view.dispatch({
    selection: { anchor: bodyLine.from },
    scrollIntoView: true,
  });
}

function cacheKey(source: string, theme: MermaidTheme): string {
  return `${theme}\0${source}`;
}

function currentMermaidTheme(): MermaidTheme {
  if (typeof document === 'undefined') {
    return 'default';
  }
  return mermaidThemeFromDom(document.documentElement);
}

function mermaidDecorations(state: EditorState): DecorationSet {
  return mermaidErrorBoundary(
    () => {
      const fences = findMermaidFenceRangesInDoc(state.doc);
      const plans = planMermaidDecorationsFromFences(fences, {
        readOnly: state.facet(readOnlyFacet),
        ranges: state.selection.ranges,
      });
      const theme = state.field(mermaidThemeField);
      const ranges = plans.map((plan) => {
        const widget = new MermaidWidget({
          source: plan.body,
          theme,
          clickToEdit: !state.facet(readOnlyFacet),
          fenceFrom: plan.fenceFrom,
        });
        if (plan.kind === 'replace') {
          return Decoration.replace({
            widget,
            block: true,
            inclusive: true,
          }).range(plan.fenceFrom, plan.fenceTo);
        }
        return Decoration.widget({
          widget,
          block: true,
          side: 1,
        }).range(plan.fenceTo);
      });
      return Decoration.set(ranges, true);
    },
    () => Decoration.none,
  );
}

const mermaidBlocksField = StateField.define<DecorationSet>({
  create: (state) => mermaidDecorations(state),
  update(deco, tr) {
    const themeChanged = tr.effects.some((effect) => effect.is(mermaidThemeEffect));
    const readOnlyChanged =
      tr.startState.facet(readOnlyFacet) !== tr.state.facet(readOnlyFacet);
    const nextFences = findMermaidFenceRangesInDoc(tr.state.doc);
    const occupancy = mermaidFenceOccupancy(
      nextFences,
      tr.state.selection.ranges,
      tr.state.facet(readOnlyFacet),
    );
    const prevOccupancy = mermaidFenceOccupancy(
      findMermaidFenceRangesInDoc(tr.startState.doc),
      tr.startState.selection.ranges,
      tr.startState.facet(readOnlyFacet),
    );
    if (
      !mermaidDecorationsShouldRebuild({
        docChanged: tr.docChanged,
        themeChanged,
        readOnlyChanged,
        occupancyChanged: occupancy !== prevOccupancy,
      })
    ) {
      return deco;
    }
    return mermaidDecorations(tr.state);
  },
  provide: (field) => EditorView.decorations.from(field),
});

/** Consumer CM6 extension: mermaid fences render as SVG widgets; disk text is unchanged. */
export function mermaidBlocks(): Extension {
  return [mermaidThemeField, mermaidThemeWatcher, mermaidBlocksField];
}
