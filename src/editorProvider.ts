import * as vscode from 'vscode';
import {
  CONTEXT_FIND_OPEN,
  CONTEXT_OUTLINE,
  CONTEXT_PALETTE,
  CONTEXT_READING_MODE,
  SETTING_ROOT,
  VIEW_TYPE,
} from './constants';
import { planCloseFind, planFindInEditor } from './findCommand';
import { renderWebviewHtml } from './html';
import {
  decodeBase64Bytes,
  IMAGE_SAVE_MAX_BYTES,
  planSavedImagePath,
  imageReadFailedMessage,
  imageWriteFailedMessage,
  untitledImageError,
} from './imageSave';
import type { HostToWebview, WebviewToHost } from './protocol';
import { isFormatAction, isSendToChatMessage } from './protocol';
import { openCursorChat, planSendToChat } from './sendToChat';
import { addSession, removeSession } from './sessionMap';
import {
  consumeVersionedEcho,
  planAfterApplyEdit,
  planBeforeApply,
  type VersionedEcho,
} from './sync';
import { toLineFeed } from './text';
import { currentPaletteKind, readAppearance, themeUpdateTarget } from './themeConfig';
import { nextExplicitTheme } from './themeSetting';
import {
  collectLocalResourceRoots,
  documentDirectory,
  documentEol,
  openMarkdownLink,
  webviewDirUri,
} from './uris';

interface DocumentSession {
  panel: vscode.WebviewPanel;
  generation: number;
  pendingEcho: VersionedEcho | undefined;
  readOnly: boolean;
  messageQueue: Promise<void>;
}

export class AtomicMarkdownEditorProvider implements vscode.CustomTextEditorProvider {
  private readonly sessions = new Map<string, DocumentSession[]>();
  private readonly documentQueues = new Map<string, Promise<void>>();
  private active: DocumentSession | undefined;

  constructor(private readonly context: vscode.ExtensionContext) {}

  static register(context: vscode.ExtensionContext): AtomicMarkdownEditorProvider {
    const provider = new AtomicMarkdownEditorProvider(context);
    context.subscriptions.push(
      vscode.window.registerCustomEditorProvider(VIEW_TYPE, provider, {
        webviewOptions: {
          retainContextWhenHidden: true,
          enableFindWidget: false,
        },
        supportsMultipleEditorsPerDocument: true,
      }),
      vscode.workspace.onDidChangeConfiguration((event) => {
        if (!event.affectsConfiguration(SETTING_ROOT)) {
          return;
        }
        provider.broadcastAppearance();
        provider.updateUiContext();
      }),
      vscode.window.onDidChangeActiveColorTheme(() => {
        provider.updateUiContext();
      }),
    );
    provider.updateUiContext();
    return provider;
  }

  async resolveCustomTextEditor(
    document: vscode.TextDocument,
    webviewPanel: vscode.WebviewPanel,
    _token: vscode.CancellationToken,
  ): Promise<void> {
    const key = document.uri.toString();
    const readOnly = this.context.workspaceState.get<boolean>(this.readOnlyStateKey(key), false);

    webviewPanel.webview.options = {
      enableScripts: true,
      localResourceRoots: collectLocalResourceRoots(this.context.extensionUri, document),
    };

    const session: DocumentSession = {
      panel: webviewPanel,
      generation: 0,
      pendingEcho: undefined,
      readOnly,
      messageQueue: Promise.resolve(),
    };
    addSession(this.sessions, key, session);
    this.setActive(session, document.uri);

    const changeDocumentSubscription = vscode.workspace.onDidChangeTextDocument((event) => {
      if (event.document.uri.toString() !== key) {
        return;
      }
      this.forwardDocumentChange(session, event.document);
    });

    const messageSubscription = webviewPanel.webview.onDidReceiveMessage((raw: WebviewToHost) => {
      this.enqueue(session, () => this.onMessage(document, session, raw));
    });

    const viewStateSubscription = webviewPanel.onDidChangeViewState(() => {
      if (webviewPanel.active) {
        this.setActive(session, document.uri);
      } else if (this.active === session) {
        void vscode.commands.executeCommand('setContext', CONTEXT_READING_MODE, false);
        void vscode.commands.executeCommand('setContext', CONTEXT_FIND_OPEN, false);
      }
    });

    webviewPanel.onDidDispose(() => {
      changeDocumentSubscription.dispose();
      messageSubscription.dispose();
      viewStateSubscription.dispose();
      removeSession(this.sessions, key, session);
      if (this.active === session) {
        this.active = undefined;
        void vscode.commands.executeCommand('setContext', CONTEXT_READING_MODE, false);
        void vscode.commands.executeCommand('setContext', CONTEXT_FIND_OPEN, false);
      }
    });

    webviewPanel.webview.html = renderWebviewHtml(
      webviewPanel.webview,
      this.context.extensionUri,
      currentPaletteKind(),
    );
  }

  async toggleLightDark(): Promise<void> {
    const next = nextExplicitTheme(currentPaletteKind());
    await vscode.workspace.getConfiguration('atomicMarkdown').update('theme', next, themeUpdateTarget());
  }

  broadcastAppearance(): void {
    const appearance = readAppearance();
    for (const list of this.sessions.values()) {
      for (const session of list) {
        this.post(session, { type: 'setAppearance', appearance });
      }
    }
    this.updateUiContext();
  }

  updateUiContext(): void {
    const appearance = readAppearance();
    void vscode.commands.executeCommand('setContext', CONTEXT_PALETTE, currentPaletteKind());
    void vscode.commands.executeCommand('setContext', CONTEXT_OUTLINE, appearance.outlineEnabled);
  }

  toggleReadingMode(): void {
    const session = this.active;
    if (!session) {
      return;
    }
    this.post(session, { type: 'toggleReadOnly' });
  }

  findInEditor(): void {
    const session = this.active;
    const plan = planFindInEditor(Boolean(session));
    if (!session || !plan.post) {
      return;
    }
    if (plan.focusWebview) {
      session.panel.reveal(session.panel.viewColumn, false);
    }
    void vscode.commands.executeCommand('setContext', CONTEXT_FIND_OPEN, true);
    this.post(session, { type: 'openSearch' });
  }

  closeFind(): void {
    const session = this.active;
    const plan = planCloseFind(Boolean(session));
    if (!session || !plan.post) {
      return;
    }
    this.post(session, { type: 'closeSearch' });
    void vscode.commands.executeCommand('setContext', CONTEXT_FIND_OPEN, false);
  }

  format(action: unknown): void {
    if (!isFormatAction(action) || !this.active) {
      return;
    }
    this.post(this.active, { type: 'format', action });
  }

  toggleOutline(): void {
    const session = this.active;
    if (!session) {
      return;
    }
    this.post(session, { type: 'toggleOutline' });
  }

  private enqueue(session: DocumentSession, work: () => Promise<void>): void {
    session.messageQueue = session.messageQueue.then(work, work);
  }

  private enqueueDocument(uri: string, work: () => Promise<void>): Promise<void> {
    const next = (this.documentQueues.get(uri) ?? Promise.resolve()).then(work, work);
    this.documentQueues.set(uri, next);
    return next;
  }

  private forwardDocumentChange(session: DocumentSession, document: vscode.TextDocument): void {
    const text = document.getText();
    const consumed = consumeVersionedEcho(session.pendingEcho, text, document.version);
    session.pendingEcho = consumed.echo;
    if (consumed.isEcho) {
      return;
    }

    session.generation += 1;
    this.post(session, {
      type: 'setMarkdown',
      text: toLineFeed(text),
      generation: session.generation,
    });
  }

  private async onMessage(
    document: vscode.TextDocument,
    session: DocumentSession,
    message: WebviewToHost,
  ): Promise<void> {
    switch (message.type) {
      case 'ready':
        this.post(session, this.initMessage(document, session));
        return;
      case 'edit':
        await this.enqueueDocument(document.uri.toString(), () =>
          this.applyWebviewEdit(document, session, message.text, message.generation),
        );
        return;
      case 'openLink':
        await openMarkdownLink(message.href, document);
        return;
      case 'readOnlyChanged':
        session.readOnly = message.readOnly;
        await this.context.workspaceState.update(
          this.readOnlyStateKey(document.uri.toString()),
          message.readOnly,
        );
        if (this.active === session) {
          await vscode.commands.executeCommand('setContext', CONTEXT_READING_MODE, message.readOnly);
        }
        return;
      case 'saveImage':
        await this.saveImage(document, session, message);
        return;
      case 'findOpenChanged':
        if (this.active === session) {
          await vscode.commands.executeCommand('setContext', CONTEXT_FIND_OPEN, message.open);
        }
        return;
      case 'sendToChat':
        if (!isSendToChatMessage(message)) {
          return;
        }
        await this.sendSelectionToChat(document, message);
        return;
    }
  }

  private async sendSelectionToChat(
    document: vscode.TextDocument,
    message: Extract<WebviewToHost, { type: 'sendToChat' }>,
  ): Promise<void> {
    const planned = planSendToChat({
      mode: message.mode,
      text: message.text,
      from: message.from,
      to: message.to,
      comment: message.comment,
      path: vscode.workspace.asRelativePath(document.uri, false),
      documentText: document.getText(),
    });
    await openCursorChat(planned.prompt, {
      getCommands: () => vscode.commands.getCommands(true),
      executeCommand: (command, ...args) => vscode.commands.executeCommand(command, ...args),
      writeClipboard: (text) => vscode.env.clipboard.writeText(text),
    });
  }

  private async saveImage(
    document: vscode.TextDocument,
    session: DocumentSession,
    message: Extract<WebviewToHost, { type: 'saveImage' }>,
  ): Promise<void> {
    const fail = (text: string) => {
      void vscode.window.showErrorMessage(text);
      this.post(session, { type: 'imageSaveFailed', requestId: message.requestId, message: text });
    };

    const dir = documentDirectory(document);
    if (!dir) {
      fail(untitledImageError());
      return;
    }

    let bytes: Uint8Array;
    try {
      bytes = decodeBase64Bytes(message.base64);
    } catch {
      fail(imageReadFailedMessage());
      return;
    }
    if (bytes.byteLength === 0) {
      fail('That image was empty.');
      return;
    }
    if (bytes.byteLength > IMAGE_SAVE_MAX_BYTES) {
      fail(`Image is too large (max ${Math.round(IMAGE_SAVE_MAX_BYTES / (1024 * 1024))} MB).`);
      return;
    }

    const directorySetting = vscode.workspace.getConfiguration('atomicMarkdown').get('images.directory');
    let existing: string[] = [];
    const plannedFirst = planSavedImagePath({
      directorySetting,
      mime: message.mime,
      basename: message.basename,
      existingNames: [],
      now: new Date(),
    });
    if (!plannedFirst.ok) {
      fail(plannedFirst.reason);
      return;
    }

    const folder = vscode.Uri.joinPath(dir, ...plannedFirst.directory.split('/'));
    try {
      await vscode.workspace.fs.createDirectory(folder);
    } catch {
      // Already exists, or create is recursive and raced — listing below is the source of truth.
    }
    try {
      existing = (await vscode.workspace.fs.readDirectory(folder)).map(([name]) => name);
    } catch {
      existing = [];
    }

    const planned = planSavedImagePath({
      directorySetting,
      mime: message.mime,
      basename: message.basename,
      existingNames: existing,
      now: new Date(),
    });
    if (!planned.ok) {
      fail(planned.reason);
      return;
    }

    const dest = vscode.Uri.joinPath(folder, planned.filename);
    try {
      await vscode.workspace.fs.writeFile(dest, bytes);
    } catch (error) {
      fail(imageWriteFailedMessage(planned.directory));
      return;
    }

    this.post(session, { type: 'imageSaved', requestId: message.requestId, markdown: planned.snippet });
  }

  private async applyWebviewEdit(
    document: vscode.TextDocument,
    session: DocumentSession,
    text: string,
    generation: number,
  ): Promise<void> {
    const snapshotText = document.getText();
    const snapshotVersion = document.version;
    const before = planBeforeApply({
      incomingGeneration: generation,
      sessionGeneration: session.generation,
      incomingText: text,
      snapshotText,
      snapshotVersion,
      currentText: document.getText(),
      currentVersion: document.version,
      eol: documentEol(document),
    });

    if (before.type === 'drop-stale') {
      return;
    }

    if (before.type === 'noop') {
      session.generation = before.sessionGeneration;
      return;
    }

    if (before.type === 'abort-concurrent') {
      session.pendingEcho = undefined;
      session.generation = Math.max(session.generation, before.sessionGeneration);
      this.post(session, {
        type: 'setMarkdown',
        text: before.pushText,
        generation: before.pushGeneration,
      });
      session.generation = Math.max(session.generation, before.pushGeneration);
      return;
    }

    const immediate = planBeforeApply({
      incomingGeneration: generation,
      sessionGeneration: session.generation,
      incomingText: text,
      snapshotText,
      snapshotVersion,
      currentText: document.getText(),
      currentVersion: document.version,
      eol: documentEol(document),
    });
    if (immediate.type !== 'apply') {
      if (immediate.type === 'abort-concurrent') {
        session.pendingEcho = undefined;
        this.post(session, {
          type: 'setMarkdown',
          text: immediate.pushText,
          generation: immediate.pushGeneration,
        });
        session.generation = Math.max(session.generation, immediate.pushGeneration);
      } else if (immediate.type === 'noop') {
        session.generation = immediate.sessionGeneration;
      }
      return;
    }

    const edit = new vscode.WorkspaceEdit();
    edit.replace(
      document.uri,
      new vscode.Range(document.positionAt(0), document.positionAt(document.getText().length)),
      immediate.nextText,
    );

    session.pendingEcho = {
      text: immediate.nextText,
      version: document.version + 1,
    };

    let applied = false;
    try {
      applied = await vscode.workspace.applyEdit(edit);
    } catch {
      applied = false;
    }

    const after = planAfterApplyEdit({
      applied,
      incomingGeneration: generation,
      sessionGeneration: session.generation,
      intendedText: immediate.nextText,
      documentText: document.getText(),
    });

    session.generation = Math.max(session.generation, after.sessionGeneration);

    if (after.type === 'failed') {
      session.pendingEcho = undefined;
      this.post(session, {
        type: 'setMarkdown',
        text: after.pushText,
        generation: after.pushGeneration,
      });
      return;
    }

    if (after.catchUp) {
      session.pendingEcho = undefined;
      this.post(session, {
        type: 'setMarkdown',
        text: after.catchUp.text,
        generation: after.catchUp.generation,
      });
      return;
    }

    if (session.pendingEcho && session.pendingEcho.version !== document.version) {
      session.pendingEcho = {
        text: immediate.nextText,
        version: document.version,
      };
    }
  }

  private initMessage(document: vscode.TextDocument, session: DocumentSession): HostToWebview {
    const workspaceFolder =
      vscode.workspace.getWorkspaceFolder(document.uri) ?? vscode.workspace.workspaceFolders?.[0];
    const text = toLineFeed(document.getText());
    const appearance = readAppearance();
    return {
      type: 'init',
      uri: document.uri.toString(),
      text,
      readOnly: session.readOnly,
      generation: session.generation,
      documentDirWebviewUri: webviewDirUri(session.panel.webview, documentDirectory(document)),
      workspaceWebviewUri: webviewDirUri(session.panel.webview, workspaceFolder?.uri),
      theme: appearance.theme,
      appearance,
    };
  }

  private post(session: DocumentSession, message: HostToWebview): void {
    void session.panel.webview.postMessage(message);
  }

  private setActive(session: DocumentSession, uri: vscode.Uri): void {
    this.active = session;
    void uri;
    void vscode.commands.executeCommand('setContext', CONTEXT_READING_MODE, session.readOnly);
    this.updateUiContext();
  }

  private readOnlyStateKey(documentUri: string): string {
    return `atomicMarkdown.readOnly:${documentUri}`;
  }
}
