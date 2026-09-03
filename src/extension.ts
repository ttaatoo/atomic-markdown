import * as vscode from 'vscode';
import {
  COMMAND_FIND,
  COMMAND_FORMAT,
  COMMAND_OPEN,
  COMMAND_TOGGLE_LIGHT_DARK,
  COMMAND_TOGGLE_OUTLINE,
  COMMAND_TOGGLE_READING_MODE,
  VIEW_TYPE,
} from './constants';
import { AtomicMarkdownEditorProvider } from './editorProvider';
import { activeResourceUri } from './uris';

export function activate(context: vscode.ExtensionContext): void {
  const provider = AtomicMarkdownEditorProvider.register(context);

  context.subscriptions.push(
    vscode.commands.registerCommand(COMMAND_OPEN, async (uri?: vscode.Uri) => {
      const target = activeResourceUri(uri);
      if (!target) {
        void vscode.window.showWarningMessage('Open a Markdown (.md) file first.');
        return;
      }
      if (!target.path.toLowerCase().endsWith('.md')) {
        void vscode.window.showWarningMessage('Atomic Markdown opens .md files.');
        return;
      }
      await vscode.commands.executeCommand('vscode.openWith', target, VIEW_TYPE, {
        preview: false,
        viewColumn: vscode.ViewColumn.Active,
      });
    }),
    vscode.commands.registerCommand(COMMAND_TOGGLE_READING_MODE, () => {
      provider.toggleReadingMode();
    }),
    vscode.commands.registerCommand(COMMAND_FIND, () => {
      provider.findInEditor();
    }),
    vscode.commands.registerCommand(COMMAND_TOGGLE_LIGHT_DARK, () => {
      void provider.toggleLightDark();
    }),
    vscode.commands.registerCommand(COMMAND_FORMAT, (action?: unknown) => {
      provider.format(action);
    }),
    vscode.commands.registerCommand(COMMAND_TOGGLE_OUTLINE, () => {
      provider.toggleOutline();
    }),
  );
}

export function deactivate(): void {
  // Disposals are registered on the extension context.
}
