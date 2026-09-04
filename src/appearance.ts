export interface AppearanceSettings {
  theme: import('./themeSetting').ThemeSetting;
  fontFamily: string;
  fontSize: number | null;
  lineHeight: number;
  contentWidthCh: number;
  toolbarEnabled: boolean;
  outlineEnabled: boolean;
}

export const APPEARANCE_DEFAULTS = {
  fontFamily: '',
  fontSize: null as number | null,
  lineHeight: 1.7,
  contentWidthCh: 70,
  toolbarEnabled: false,
  outlineEnabled: true,
};

function parseFiniteNumber(value: unknown): number | undefined {
  if (value === '' || value === null || value === undefined) {
    return undefined;
  }
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : undefined;
}

/** Unset / empty / invalid follows the workbench editor or UI font size. */
export function clampFontSize(value: unknown): number | null {
  const n = parseFiniteNumber(value);
  if (n === undefined) {
    return null;
  }
  return Math.min(28, Math.max(12, Math.round(n)));
}

export function clampLineHeight(value: unknown): number {
  const n = parseFiniteNumber(value);
  if (n === undefined) {
    return APPEARANCE_DEFAULTS.lineHeight;
  }
  return Math.min(2.4, Math.max(1.2, Math.round(n * 100) / 100));
}

export function clampContentWidthCh(value: unknown): number {
  const n = parseFiniteNumber(value);
  if (n === undefined) {
    return APPEARANCE_DEFAULTS.contentWidthCh;
  }
  return Math.min(120, Math.max(40, Math.round(n)));
}

/** Empty string follows the VS Code workbench/editor font. Reject CSS-breaking characters. */
export function sanitizeFontFamily(value: unknown): string {
  if (typeof value !== 'string') {
    return '';
  }
  const trimmed = value.trim();
  if (!trimmed || /[;{}<>]/.test(trimmed)) {
    return '';
  }
  return trimmed.slice(0, 160);
}

export function parseBooleanSetting(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

export function appearanceFromConfig(
  get: (key: string) => unknown,
  theme: import('./themeSetting').ThemeSetting,
): AppearanceSettings {
  return {
    theme,
    fontFamily: sanitizeFontFamily(get('fontFamily')),
    fontSize: clampFontSize(get('fontSize')),
    lineHeight: clampLineHeight(get('lineHeight')),
    contentWidthCh: clampContentWidthCh(get('contentWidth')),
    toolbarEnabled: parseBooleanSetting(get('toolbar.enabled'), APPEARANCE_DEFAULTS.toolbarEnabled),
    outlineEnabled: parseBooleanSetting(get('outline.enabled'), APPEARANCE_DEFAULTS.outlineEnabled),
  };
}
