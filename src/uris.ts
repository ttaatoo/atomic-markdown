import * as vscode from 'vscode';
import { classifyLink } from './links';

export function documentEol(document: vscode.TextDocument): '\n' | '\r\n' {
  return document.eol === vscode.EndOfLine.CRLF ? '\r\n' : '\n';
}

export function documentDirectory(document: vscode.TextDocument): vscode.Uri | undefined {
  if (document.uri.scheme !== 'file' && document.uri.scheme !== 'vscode-vfs') {
    return undefined;
  }
  return vscode.Uri.joinPath(document.uri, '..');
}

export function collectLocalResourceRoots(
  extensionUri: vscode.Uri,
  document: vscode.TextDocument,
): vscode.Uri[] {
  const roots = [vscode.Uri.joinPath(extensionUri, 'dist')];
  const dir = documentDirectory(document);
  if (dir) {
    roots.push(dir);
  }
  for (const folder of vscode.workspace.workspaceFolders ?? []) {
    roots.push(folder.uri);
  }
  return roots;
}

export function webviewDirUri(
  webview: vscode.Webview,
  directory: vscode.Uri | undefined,
): string | undefined {
  if (!directory) {
    return undefined;
  }
  return webview.asWebviewUri(directory).toString();
}

export async function openMarkdownLink(
  href: string,
  document: vscode.TextDocument,
): Promise<void> {
  const classified = classifyLink(href);
  if (classified.kind === 'ignore') {
    return;
  }

  if (classified.kind === 'external') {
    await vscode.env.openExternal(vscode.Uri.parse(classified.href));
    return;
  }

  const uri = resolveFileLink(classified.path, document);
  if (!uri) {
    return;
  }
  const target = classified.fragment ? uri.with({ fragment: classified.fragment }) : uri;
  await vscode.commands.executeCommand('vscode.open', target);
}

function resolveFileLink(pathPart: string, document: vscode.TextDocument): vscode.Uri | undefined {
  try {
    if (pathPart.startsWith('file:')) {
      return vscode.Uri.parse(pathPart);
    }

    const decoded = decodeURIComponent(pathPart);
    if (decoded.startsWith('/')) {
      const folder =
        vscode.workspace.getWorkspaceFolder(document.uri) ?? vscode.workspace.workspaceFolders?.[0];
      if (!folder) {
        return undefined;
      }
      return vscode.Uri.joinPath(folder.uri, decoded.replace(/^\/+/, ''));
    }

    return vscode.Uri.joinPath(document.uri, '..', decoded);
  } catch {
    return undefined;
  }
}

export function activeResourceUri(explicit?: vscode.Uri): vscode.Uri | undefined {
  if (explicit) {
    return explicit;
  }

  const editor = vscode.window.activeTextEditor;
  if (editor) {
    return editor.document.uri;
  }

  const input = vscode.window.tabGroups.activeTabGroup.activeTab?.input;
  if (input instanceof vscode.TabInputText || input instanceof vscode.TabInputCustom) {
    return input.uri;
  }
  if (input instanceof vscode.TabInputTextDiff) {
    return input.modified;
  }
  return undefined;
}
