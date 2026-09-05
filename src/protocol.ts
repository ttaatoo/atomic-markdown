import type { AppearanceSettings } from './appearance';
import type { ThemeSetting } from './themeSetting';

export type { AppearanceSettings };

export type FormatAction =
  | 'bold'
  | 'italic'
  | 'strike'
  | 'inlineCode'
  | 'link'
  | 'heading'
  | 'bulletList'
  | 'numberedList'
  | 'taskList';

const FORMAT_ACTIONS = new Set<FormatAction>([
  'bold',
  'italic',
  'strike',
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

export type SendToChatMode = 'selection' | 'comment' | 'global';

export type SendToChatMessage = {
  type: 'sendToChat';
  mode: SendToChatMode;
  text: string;
  from: number;
  to: number;
  comment?: string;
};

export type CopyTextMessage = {
  type: 'copyText';
  text: string;
};

export type CopyDocumentMessage = {
  type: 'copyDocument';
};

export type DocumentCopiedMessage = {
  type: 'documentCopied';
  ok: boolean;
  message?: string;
};

export function isSendToChatMessage(value: unknown): value is SendToChatMessage {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const message = value as Record<string, unknown>;
  if (message.type !== 'sendToChat') {
    return false;
  }
  if (message.mode !== 'selection' && message.mode !== 'comment' && message.mode !== 'global') {
    return false;
  }
  if (typeof message.text !== 'string') {
    return false;
  }
  if (typeof message.from !== 'number' || typeof message.to !== 'number') {
    return false;
  }
  if (!Number.isFinite(message.from) || !Number.isFinite(message.to)) {
    return false;
  }
  if (message.comment !== undefined && typeof message.comment !== 'string') {
    return false;
  }
  return true;
}

export function isCopyTextMessage(value: unknown): value is CopyTextMessage {
  return Boolean(
    value &&
      typeof value === 'object' &&
      (value as { type?: unknown }).type === 'copyText' &&
      typeof (value as { text?: unknown }).text === 'string',
  );
}

export function isCopyDocumentMessage(value: unknown): value is CopyDocumentMessage {
  return Boolean(value && typeof value === 'object' && (value as { type?: unknown }).type === 'copyDocument');
}

export function isDocumentCopiedMessage(value: unknown): value is DocumentCopiedMessage {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const message = value as Record<string, unknown>;
  if (message.type !== 'documentCopied' || typeof message.ok !== 'boolean') {
    return false;
  }
  if (message.message !== undefined && typeof message.message !== 'string') {
    return false;
  }
  return true;
}

export type WebviewToHost =
  | { type: 'ready' }
  | { type: 'edit'; text: string; generation: number }
  | { type: 'openLink'; href: string }
  | { type: 'readOnlyChanged'; readOnly: boolean }
  | { type: 'saveImage'; requestId: string; mime: string; basename?: string; base64: string }
  | { type: 'findOpenChanged'; open: boolean }
  | SendToChatMessage
  | CopyTextMessage
  | CopyDocumentMessage;

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
  | { type: 'closeSearch' }
  | { type: 'setTheme'; theme: ThemeSetting }
  | { type: 'setAppearance'; appearance: AppearanceSettings }
  | { type: 'format'; action: FormatAction }
  | { type: 'toggleOutline' }
  | { type: 'imageSaved'; requestId: string; markdown: string }
  | { type: 'imageSaveFailed'; requestId: string; message: string }
  | DocumentCopiedMessage;
