import * as vscode from 'vscode';
import { CONTEXT_PALETTE, CONTEXT_READING_MODE, SETTING_THEME, VIEW_TYPE } from './constants';
import type { HostToWebview, WebviewToHost } from './protocol';
import { renderWebviewHtml } from './html';
import { currentPaletteKind, readThemeSetting, themeUpdateTarget } from './themeConfig';
import { nextExplicitTheme } from './themeSetting';
import {
  isEchoDocumentChange,
  planAfterApplyEdit,
  planWebviewEdit,
  shouldAbortApplyBecauseDocumentMoved,
} from './sync';
import { toLineFeed } from './text';
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
  lastAppliedText: string | undefined;
  lastPushedToWebview: string | undefined;
  readOnly: boolean;
  messageQueue: Promise<void>;
}

export class AtomicMarkdownEditorProvider implements vscode.CustomTextEditorProvider {
  private readonly sessions = new Map<string, DocumentSession>();
  private activeDocumentUri: string | undefined;

  constructor(private readonly context: vscode.ExtensionContext) {}

  static register(context: vscode.ExtensionContext): AtomicMarkdownEditorProvider {
    const provider = new AtomicMarkdownEditorProvider(context);
    context.subscriptions.push(
      vscode.window.registerCustomEditorProvider(VIEW_TYPE, provider, {
        webviewOptions: {
          retainContextWhenHidden: true,
        },
        supportsMultipleEditorsPerDocument: false,
      }),
      vscode.workspace.onDidChangeConfiguration((event) => {
        if (!event.affectsConfiguration(SETTING_THEME)) {
          return;
        }
        provider.broadcastTheme();
        provider.updatePaletteContext();
      }),
      vscode.window.onDidChangeActiveColorTheme(() => {
        provider.updatePaletteContext();
      }),
    );
    provider.updatePaletteContext();
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
      lastAppliedText: undefined,
      lastPushedToWebview: undefined,
      readOnly,
      messageQueue: Promise.resolve(),
    };
    this.sessions.set(key, session);
    this.setActive(document.uri, session);

    const changeDocumentSubscription = vscode.workspace.onDidChangeTextDocument((event) => {
      if (event.document.uri.toString() !== key) {
        return;
      }
      this.forwardDocumentChange(session, event.document);
    });

    // Subscribe before assigning html so a fast `ready` from the webview is not missed.
    // Serialize handlers: VS Code does not, and overlapping applyEdit calls
    // would otherwise clear echo state while another write is in flight.
    const messageSubscription = webviewPanel.webview.onDidReceiveMessage((raw: WebviewToHost) => {
      this.enqueue(session, () => this.onMessage(document, session, raw));
    });

    const viewStateSubscription = webviewPanel.onDidChangeViewState(() => {
      if (webviewPanel.active) {
        this.setActive(document.uri, session);
      } else if (this.activeDocumentUri === key) {
        void vscode.commands.executeCommand('setContext', CONTEXT_READING_MODE, false);
      }
    });

    webviewPanel.onDidDispose(() => {
      changeDocumentSubscription.dispose();
      messageSubscription.dispose();
      viewStateSubscription.dispose();
      this.sessions.delete(key);
      if (this.activeDocumentUri === key) {
        this.activeDocumentUri = undefined;
        void vscode.commands.executeCommand('setContext', CONTEXT_READING_MODE, false);
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

  broadcastTheme(): void {
    const theme = readThemeSetting();
    for (const session of this.sessions.values()) {
      this.post(session, { type: 'setTheme', theme });
    }
  }

  updatePaletteContext(): void {
    void vscode.commands.executeCommand('setContext', CONTEXT_PALETTE, currentPaletteKind());
  }

  toggleReadingMode(): void {
    const session = this.activeSession();
    if (!session) {
      return;
    }
    this.post(session, { type: 'toggleReadOnly' });
  }

  findInEditor(): void {
    const session = this.activeSession();
    if (!session) {
      return;
    }
    this.post(session, { type: 'openSearch' });
  }

  private enqueue(session: DocumentSession, work: () => Promise<void>): void {
    session.messageQueue = session.messageQueue.then(work, work);
  }

  private forwardDocumentChange(session: DocumentSession, document: vscode.TextDocument): void {
    const text = document.getText();
    if (isEchoDocumentChange(text, session.lastAppliedText)) {
      return;
    }
    if (session.lastPushedToWebview !== undefined && isEchoDocumentChange(text, session.lastPushedToWebview)) {
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
        await this.applyWebviewEdit(document, session, message.text, message.generation);
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
        if (this.activeDocumentUri === document.uri.toString()) {
          await vscode.commands.executeCommand('setContext', CONTEXT_READING_MODE, message.readOnly);
        }
        return;
    }
  }

  private async applyWebviewEdit(
    document: vscode.TextDocument,
    session: DocumentSession,
    text: string,
    generation: number,
  ): Promise<void> {
    const snapshot = document.getText();
    const plan = planWebviewEdit({
      incomingGeneration: generation,
      sessionGeneration: session.generation,
      incomingText: text,
      documentText: snapshot,
      eol: documentEol(document),
    });

    if (plan.type === 'drop-stale') {
      return;
    }

    if (plan.type === 'noop') {
      session.generation = generation;
      return;
    }

    if (shouldAbortApplyBecauseDocumentMoved(snapshot, document.getText())) {
      return;
    }

    session.lastAppliedText = plan.nextText;
    const edit = new vscode.WorkspaceEdit();
    edit.replace(
      document.uri,
      new vscode.Range(document.positionAt(0), document.positionAt(document.getText().length)),
      plan.nextText,
    );

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
      intendedText: plan.nextText,
      documentText: document.getText(),
    });

    session.generation = Math.max(session.generation, after.sessionGeneration);

    if (after.type === 'failed') {
      session.lastAppliedText = undefined;
      this.post(session, {
        type: 'setMarkdown',
        text: after.pushText,
        generation: after.pushGeneration,
      });
      return;
    }

    if (after.catchUp) {
      this.post(session, {
        type: 'setMarkdown',
        text: after.catchUp.text,
        generation: after.catchUp.generation,
      });
    }
  }

  private initMessage(document: vscode.TextDocument, session: DocumentSession): HostToWebview {
    const workspaceFolder =
      vscode.workspace.getWorkspaceFolder(document.uri) ?? vscode.workspace.workspaceFolders?.[0];
    const text = toLineFeed(document.getText());
    return {
      type: 'init',
      uri: document.uri.toString(),
      text,
      readOnly: session.readOnly,
      generation: session.generation,
      documentDirWebviewUri: webviewDirUri(session.panel.webview, documentDirectory(document)),
      workspaceWebviewUri: webviewDirUri(session.panel.webview, workspaceFolder?.uri),
      theme: readThemeSetting(),
    };
  }

  private post(session: DocumentSession, message: HostToWebview): void {
    if (message.type === 'init' || message.type === 'setMarkdown') {
      session.lastPushedToWebview = message.text;
    }
    void session.panel.webview.postMessage(message);
  }

  private setActive(uri: vscode.Uri, session: DocumentSession): void {
    this.activeDocumentUri = uri.toString();
    void vscode.commands.executeCommand('setContext', CONTEXT_READING_MODE, session.readOnly);
    this.updatePaletteContext();
  }

  private activeSession(): DocumentSession | undefined {
    if (!this.activeDocumentUri) {
      return undefined;
    }
    return this.sessions.get(this.activeDocumentUri);
  }

  private readOnlyStateKey(documentUri: string): string {
    return `atomicMarkdown.readOnly:${documentUri}`;
  }
}
