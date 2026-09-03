export type WebviewToHost =
  | { type: 'ready' }
  | { type: 'edit'; text: string; generation: number }
  | { type: 'openLink'; href: string }
  | { type: 'readOnlyChanged'; readOnly: boolean };

export type HostToWebview =
  | {
      type: 'init';
      uri: string;
      text: string;
      readOnly: boolean;
      generation: number;
      documentDirWebviewUri?: string;
      workspaceWebviewUri?: string;
    }
  | { type: 'setMarkdown'; text: string; generation: number }
  | { type: 'setReadOnly'; readOnly: boolean }
  | { type: 'toggleReadOnly' }
  | { type: 'openSearch' };
