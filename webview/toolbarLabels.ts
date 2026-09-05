import type { FormatAction } from '../src/protocol.ts';

export function modifierGlyph(platform: string): '⌘' | 'Ctrl+' {
  return /Mac|iPhone|iPad/i.test(platform) ? '⌘' : 'Ctrl+';
}

export function formatActionTitle(action: FormatAction, platform: string): string {
  const mod = modifierGlyph(platform);
  switch (action) {
    case 'bold':
      return `Bold (${mod}B)`;
    case 'italic':
      return `Italic (${mod}I)`;
    case 'strike':
      return 'Strikethrough';
    case 'link':
      return `Link (${mod}K)`;
    case 'inlineCode':
      return 'Inline code';
    case 'heading':
      return 'Cycle heading';
    case 'bulletList':
      return 'Bulleted list';
    case 'numberedList':
      return 'Numbered list';
    case 'taskList':
      return 'Task list';
  }
}

export function outlineToggleTitle(open: boolean): string {
  return open ? 'Hide outline' : 'Show outline';
}
