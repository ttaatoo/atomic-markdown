import * as vscode from 'vscode';
import {
  COMMAND_CLOSE_FIND,
  COMMAND_FIND,
  COMMAND_FORMAT,
  COMMAND_OPEN,
  COMMAND_TOGGLE_LIGHT_DARK,
  COMMAND_TOGGLE_OUTLINE,
  COMMAND_TOGGLE_READING_MODE,
} from './constants';
import { AtomicMarkdownEditorProvider } from './editorProvider';
import { openMarkdownWithAtomic } from './openEditor';

export function activate(context: vscode.ExtensionContext): void {
  const provider = AtomicMarkdownEditorProvider.register(context);

  context.subscriptions.push(
    vscode.commands.registerCommand(COMMAND_OPEN, (uri?: vscode.Uri) => openMarkdownWithAtomic(uri)),
    vscode.commands.registerCommand(COMMAND_TOGGLE_READING_MODE, () => {
      provider.toggleReadingMode();
    }),
    vscode.commands.registerCommand(COMMAND_FIND, () => {
      provider.findInEditor();
    }),
    vscode.commands.registerCommand(COMMAND_CLOSE_FIND, () => {
      provider.closeFind();
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
