import * as vscode from 'vscode';
import { appearanceFromConfig, type AppearanceSettings } from './appearance';
import {
  parseThemeSetting,
  resolvePaletteKind,
  themeConfigurationTarget,
  workbenchKindIsLight,
  type PaletteKind,
  type ThemeSetting,
} from './themeSetting';

export function readThemeSetting(): ThemeSetting {
  return parseThemeSetting(vscode.workspace.getConfiguration('atomicMarkdown').get('theme'));
}

export function readAppearance(): AppearanceSettings {
  const cfg = vscode.workspace.getConfiguration('atomicMarkdown');
  return appearanceFromConfig((key) => cfg.get(key), readThemeSetting());
}

export function workbenchIsLight(): boolean {
  return workbenchKindIsLight(vscode.window.activeColorTheme.kind);
}

export function currentPaletteKind(): PaletteKind {
  return resolvePaletteKind(readThemeSetting(), workbenchIsLight());
}

export function themeUpdateTarget(): vscode.ConfigurationTarget {
  return themeConfigurationTarget(Boolean(vscode.workspace.workspaceFolders?.length)) === 'workspace'
    ? vscode.ConfigurationTarget.Workspace
    : vscode.ConfigurationTarget.Global;
}
