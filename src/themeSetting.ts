export const THEME_SETTING_VALUES = ['followVscode', 'dark', 'light'] as const;

export type ThemeSetting = (typeof THEME_SETTING_VALUES)[number];

export type PaletteKind = 'dark' | 'light';

export function parseThemeSetting(value: unknown): ThemeSetting {
  if (value === 'dark' || value === 'light' || value === 'followVscode') {
    return value;
  }
  return 'followVscode';
}

/** `followVscode` still uses the Plannotator palettes — only the side is chosen. */
export function resolvePaletteKind(setting: ThemeSetting, workbenchIsLight: boolean): PaletteKind {
  if (setting === 'light' || setting === 'dark') {
    return setting;
  }
  return workbenchIsLight ? 'light' : 'dark';
}

export function nextExplicitTheme(resolved: PaletteKind): Exclude<ThemeSetting, 'followVscode'> {
  return resolved === 'light' ? 'dark' : 'light';
}

export function htmlThemeClass(palette: PaletteKind): string {
  return palette === 'light' ? 'theme-plannotator light' : 'theme-plannotator';
}

export function themeConfigurationTarget(hasWorkspaceFolder: boolean): 'workspace' | 'global' {
  return hasWorkspaceFolder ? 'workspace' : 'global';
}

export function workbenchKindIsLight(kind: number): boolean {
  // vscode.ColorThemeKind: Light = 1, Dark = 2, HighContrast = 3, HighContrastLight = 4
  return kind === 1 || kind === 4;
}
