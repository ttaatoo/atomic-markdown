import type { AppearanceSettings } from './appearance';
import type { ThemeSetting } from './themeSetting';

export type { AppearanceSettings };

export type FormatAction =
  | 'bold'
  | 'italic'
  | 'inlineCode'
  | 'link'
  | 'heading'
  | 'bulletList'
  | 'numberedList'
  | 'taskList';

const FORMAT_ACTIONS = new Set<FormatAction>([
  'bold',
  'italic',
  'inlineCode',
  'link',
  'heading',
  'bulletList',
  'numberedList',
  'taskList',
]);

export function isFormatAction(value: unknown): value is FormatAction {
  return typeof value === 'string' && FORMAT_ACTIONS.has(value as FormatAction);
}

export type WebviewToHost =
  | { type: 'ready' }
  | { type: 'edit'; text: string; generation: number }
  | { type: 'openLink'; href: string }
  | { type: 'readOnlyChanged'; readOnly: boolean }
  | { type: 'saveImage'; requestId: string; mime: string; basename?: string; base64: string };

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
      appearance: AppearanceSettings;
    }
  | { type: 'setMarkdown'; text: string; generation: number }
  | { type: 'setReadOnly'; readOnly: boolean }
  | { type: 'toggleReadOnly' }
  | { type: 'openSearch' }
  | { type: 'setTheme'; theme: ThemeSetting }
  | { type: 'setAppearance'; appearance: AppearanceSettings }
  | { type: 'format'; action: FormatAction }
  | { type: 'toggleOutline' }
  | { type: 'imageSaved'; requestId: string; markdown: string }
  | { type: 'imageSaveFailed'; requestId: string; message: string };
