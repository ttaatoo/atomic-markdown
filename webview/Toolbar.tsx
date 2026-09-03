import type { FormatAction } from '../src/protocol.ts';

const ACTIONS: Array<{ action: FormatAction; label: string; glyph: string }> = [
  { action: 'bold', label: 'Bold', glyph: 'B' },
  { action: 'italic', label: 'Italic', glyph: 'I' },
  { action: 'inlineCode', label: 'Inline code', glyph: '</>' },
  { action: 'link', label: 'Link', glyph: '↗' },
  { action: 'heading', label: 'Cycle heading', glyph: 'H' },
  { action: 'bulletList', label: 'Bulleted list', glyph: '•' },
  { action: 'numberedList', label: 'Numbered list', glyph: '1.' },
  { action: 'taskList', label: 'Task list', glyph: '☐' },
];

export function Toolbar(props: {
  readOnly: boolean;
  outlineOpen: boolean;
  outlineEnabled: boolean;
  onFormat: (action: FormatAction) => void;
  onToggleOutline: () => void;
}) {
  return (
    <div className="atomic-toolbar" role="toolbar" aria-label="Markdown formatting">
      {ACTIONS.map((item) => (
        <button
          key={item.action}
          type="button"
          className="atomic-toolbar-btn"
          aria-label={item.label}
          title={item.label}
          disabled={props.readOnly}
          onClick={() => props.onFormat(item.action)}
        >
          {item.glyph}
        </button>
      ))}
      {props.outlineEnabled ? (
        <>
          <span className="atomic-toolbar-sep" aria-hidden="true" />
          <button
            type="button"
            className="atomic-toolbar-btn"
            aria-label={props.outlineOpen ? 'Hide outline' : 'Show outline'}
            title="Outline"
            aria-pressed={props.outlineOpen}
            onClick={props.onToggleOutline}
          >
            ☰
          </button>
        </>
      ) : null}
    </div>
  );
}
