import * as vscode from 'vscode';
import { VIEW_TYPE } from './constants';
import { isMarkdownPath, planOpenAtomic, type OpenAtomicTab } from './openEditorPlan';
import { activeResourceUri } from './uris';

export { isMarkdownPath, planOpenAtomic };
export type { OpenAtomicPlan, OpenAtomicReason, OpenAtomicTab } from './openEditorPlan';

export async function openMarkdownWithAtomic(uri?: vscode.Uri): Promise<void> {
  const target = activeResourceUri(uri);
  if (!target) {
    void vscode.window.showWarningMessage('Open a Markdown (.md) file first.');
    return;
  }
  if (!isMarkdownPath(target.path)) {
    void vscode.window.showWarningMessage('Atomic Markdown opens .md files.');
    return;
  }

  const tabs = collectTabsFor(target);
  const plan = planOpenAtomic({
    hasTarget: true,
    isMarkdown: true,
    tabs,
  });

  if (plan.type === 'warn') {
    void vscode.window.showWarningMessage(plan.message);
    return;
  }
  if (plan.type === 'noop') {
    return;
  }

  const column = plan.type === 'replace' ? plan.column : vscode.ViewColumn.Active;
  if (plan.type === 'replace') {
    await closeTextEditorTabs(target, plan.column);
  }

  await vscode.commands.executeCommand('vscode.openWith', target, VIEW_TYPE, {
    preview: false,
    viewColumn: column,
  });
}

function collectTabsFor(uri: vscode.Uri): OpenAtomicTab[] {
  const key = uri.toString();
  const out: OpenAtomicTab[] = [];
  for (const group of vscode.window.tabGroups.all) {
    for (const tab of group.tabs) {
      const kind = tabKind(tab.input, key);
      if (!kind) {
        continue;
      }
      out.push({
        kind,
        isActive: tab.isActive,
        column: group.viewColumn,
      });
    }
  }
  return out;
}

function tabKind(input: unknown, key: string): OpenAtomicTab['kind'] | undefined {
  if (input instanceof vscode.TabInputText && input.uri.toString() === key) {
    return 'text';
  }
  if (input instanceof vscode.TabInputCustom && input.uri.toString() === key) {
    return input.viewType === VIEW_TYPE ? 'atomic' : 'other';
  }
  return undefined;
}

async function closeTextEditorTabs(uri: vscode.Uri, column: number): Promise<void> {
  const key = uri.toString();
  const toClose: vscode.Tab[] = [];
  for (const group of vscode.window.tabGroups.all) {
    if (group.viewColumn !== column) {
      continue;
    }
    for (const tab of group.tabs) {
      if (tab.input instanceof vscode.TabInputText && tab.input.uri.toString() === key) {
        toClose.push(tab);
      }
    }
  }
  if (toClose.length > 0) {
    await vscode.window.tabGroups.close(toClose, true);
  }
}
