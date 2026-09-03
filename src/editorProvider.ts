import * as vscode from 'vscode';
import { CONTEXT_READING_MODE, VIEW_TYPE } from './constants';
import type { HostToWebview, WebviewToHost } from './protocol';
import { renderWebviewHtml } from './html';
import { sameMarkdown, toDocumentEol, toLineFeed } from './text';
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
  applyingFromWebview: boolean;
  readOnly: boolean;
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
    );
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
      applyingFromWebview: false,
      readOnly,
    };
    this.sessions.set(key, session);
    this.setActive(document.uri, session);

    const changeDocumentSubscription = vscode.workspace.onDidChangeTextDocument((event) => {
      if (event.document.uri.toString() !== key) {
        return;
      }
      if (session.applyingFromWebview) {
        return;
      }
      session.generation += 1;
      this.post(webviewPanel, {
        type: 'setMarkdown',
        text: toLineFeed(event.document.getText()),
        generation: session.generation,
      });
    });

    // Subscribe before assigning html so a fast `ready` from the webview is not missed.
    const messageSubscription = webviewPanel.webview.onDidReceiveMessage(async (raw: WebviewToHost) => {
      await this.onMessage(document, session, raw);
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

    webviewPanel.webview.html = renderWebviewHtml(webviewPanel.webview, this.context.extensionUri);
  }

  toggleReadingMode(): void {
    const session = this.activeSession();
    if (!session) {
      return;
    }
    this.post(session.panel, { type: 'toggleReadOnly' });
  }

  findInEditor(): void {
    const session = this.activeSession();
    if (!session) {
      return;
    }
    this.post(session.panel, { type: 'openSearch' });
  }

  private async onMessage(
    document: vscode.TextDocument,
    session: DocumentSession,
    message: WebviewToHost,
  ): Promise<void> {
    switch (message.type) {
      case 'ready':
        this.post(session.panel, this.initMessage(document, session));
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
    session.generation = generation;
    const next = toDocumentEol(text, documentEol(document));
    if (sameMarkdown(next, document.getText())) {
      return;
    }

    session.applyingFromWebview = true;
    try {
      const edit = new vscode.WorkspaceEdit();
      edit.replace(
        document.uri,
        new vscode.Range(document.positionAt(0), document.positionAt(document.getText().length)),
        next,
      );
      await vscode.workspace.applyEdit(edit);
    } finally {
      session.applyingFromWebview = false;
    }
  }

  private initMessage(document: vscode.TextDocument, session: DocumentSession): HostToWebview {
    const workspaceFolder =
      vscode.workspace.getWorkspaceFolder(document.uri) ?? vscode.workspace.workspaceFolders?.[0];
    return {
      type: 'init',
      uri: document.uri.toString(),
      text: toLineFeed(document.getText()),
      readOnly: session.readOnly,
      generation: session.generation,
      documentDirWebviewUri: webviewDirUri(session.panel.webview, documentDirectory(document)),
      workspaceWebviewUri: webviewDirUri(session.panel.webview, workspaceFolder?.uri),
    };
  }

  private post(panel: vscode.WebviewPanel, message: HostToWebview): void {
    void panel.webview.postMessage(message);
  }

  private setActive(uri: vscode.Uri, session: DocumentSession): void {
    this.activeDocumentUri = uri.toString();
    void vscode.commands.executeCommand('setContext', CONTEXT_READING_MODE, session.readOnly);
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
