import {
  resolvePaletteKind,
  type PaletteKind,
  type ThemeSetting,
} from '../src/themeSetting.ts';

export type { PaletteKind, ThemeSetting };

export function workbenchIsLightFromBody(body: { classList: { contains(name: string): boolean } }): boolean {
  return body.classList.contains('vscode-light') || body.classList.contains('vscode-high-contrast-light');
}

export function applyPaletteToRoot(
  root: { classList: { add(name: string): void; toggle(name: string, force?: boolean): boolean }; dataset: { theme?: string } },
  palette: PaletteKind,
): void {
  root.classList.add('theme-plannotator');
  root.classList.toggle('light', palette === 'light');
  root.dataset.theme = palette;
}

export function applyThemeSetting(setting: ThemeSetting): PaletteKind {
  const palette = resolvePaletteKind(setting, workbenchIsLightFromBody(document.body));
  applyPaletteToRoot(document.documentElement, palette);
  return palette;
}

export function observeTheme(getSetting: () => ThemeSetting): () => void {
  applyThemeSetting(getSetting());
  const observer = new MutationObserver(() => {
    applyThemeSetting(getSetting());
  });
  observer.observe(document.body, { attributes: true, attributeFilter: ['class'] });
  return () => observer.disconnect();
}
