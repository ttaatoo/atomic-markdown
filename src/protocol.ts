import type { ThemeSetting } from './themeSetting';

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
      theme: ThemeSetting;
    }
  | { type: 'setMarkdown'; text: string; generation: number }
  | { type: 'setReadOnly'; readOnly: boolean }
  | { type: 'toggleReadOnly' }
  | { type: 'openSearch' }
  | { type: 'setTheme'; theme: ThemeSetting };
