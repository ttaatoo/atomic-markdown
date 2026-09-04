import type { AppearanceSettings } from '../src/appearance.ts';
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
  followWorkbench = false,
): void {
  root.classList.add('theme-plannotator');
  root.classList.toggle('light', palette === 'light');
  root.classList.toggle('theme-follow', followWorkbench);
  root.dataset.theme = palette;
}

export function appearanceCssVars(settings: AppearanceSettings): Record<string, string | null> {
  return {
    '--atomic-user-font': settings.fontFamily || null,
    '--atomic-user-size': `${settings.fontSize}px`,
    '--atomic-user-leading': String(settings.lineHeight),
    '--atomic-user-measure': `${settings.contentWidthCh}ch`,
  };
}

export function applyAppearanceVars(
  style: { setProperty(name: string, value: string): void; removeProperty(name: string): void },
  settings: AppearanceSettings,
): void {
  const vars = appearanceCssVars(settings);
  for (const [name, value] of Object.entries(vars)) {
    if (value === null) {
      style.removeProperty(name);
    } else {
      style.setProperty(name, value);
    }
  }
}

export function applyAppearance(settings: AppearanceSettings): void {
  applyThemeSetting(settings.theme);
  applyAppearanceVars(document.documentElement.style, settings);
}

export function applyThemeSetting(setting: ThemeSetting): PaletteKind {
  const palette = resolvePaletteKind(setting, workbenchIsLightFromBody(document.body));
  applyPaletteToRoot(document.documentElement, palette, setting === 'followVscode');
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
