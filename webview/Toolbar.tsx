import type { FormatAction } from '../src/protocol.ts';
import type { FormatActiveMap } from './formatActive.ts';
import { formatActionTitle, outlineToggleTitle } from './toolbarLabels.ts';

const ACTIONS: Array<{ action: FormatAction; label: string; icon: string }> = [
  {
    action: 'bold',
    label: 'Bold',
    icon: '<path d="M5 4h6.2c2.3 0 3.8 1.4 3.8 3.3 0 1.4-.8 2.5-2.1 3 .9.3 2.6 1.3 2.6 3.2 0 2.2-1.7 3.5-4.2 3.5H5V4zm2.6 5.4h3.3c1 0 1.6-.6 1.6-1.4S11.9 6.6 10.9 6.6H7.6v2.8zm0 5.4h3.7c1.2 0 1.9-.6 1.9-1.6s-.7-1.6-1.9-1.6H7.6V14.8z"/>',
  },
  {
    action: 'italic',
    label: 'Italic',
    icon: '<path d="M9.2 4h6.1v1.8H12.4l-2.6 8.4h2.7V16H6.3v-1.8h2.8L11.7 5.8H9.2V4z"/>',
  },
  {
    action: 'inlineCode',
    label: 'Inline code',
    icon: '<path fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" d="M6.2 5.5 2.8 10l3.4 4.5M13.8 5.5 17.2 10l-3.4 4.5M11.2 3.8 8.8 16.2"/>',
  },
  {
    action: 'link',
    label: 'Link',
    icon: '<path fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" d="M8.2 11.8 6.4 13.6a2.4 2.4 0 0 0 3.4 3.4l2.4-2.4M11.8 8.2l1.8-1.8a2.4 2.4 0 1 1 3.4 3.4l-2.4 2.4M8.7 11.3l2.6-2.6"/>',
  },
  {
    action: 'heading',
    label: 'Cycle heading',
    icon: '<path d="M4.4 4h2.4v5.1h6.4V4h2.4v12h-2.4V11H6.8v5H4.4V4z"/>',
  },
  {
    action: 'bulletList',
    label: 'Bulleted list',
    icon: '<circle cx="4.2" cy="5.2" r="1.15"/><circle cx="4.2" cy="10" r="1.15"/><circle cx="4.2" cy="14.8" r="1.15"/><path fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" d="M7.4 5.2h8.4M7.4 10h8.4M7.4 14.8h8.4"/>',
  },
  {
    action: 'numberedList',
    label: 'Numbered list',
    icon: '<path d="M3.4 3.6h2.2v4.2H4.2V5H3.4V3.6zm0 5.4h3v1.2H4.5l1.9 2.6v.9H3.3v-1.2h1.8l-1.7-2.4V9zm.2 5.6h2.8v1H4.8v.7h1.4v1H4.8v.8h1.8v1H3.6v-4.5z"/><path fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" d="M8.4 5.2h7.4M8.4 10h7.4M8.4 14.8h7.4"/>',
  },
  {
    action: 'taskList',
    label: 'Task list',
    icon: '<rect x="2.6" y="2.8" width="5.2" height="5.2" rx="1" fill="none" stroke="currentColor" stroke-width="1.5"/><path fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" d="M3.8 5.4 4.9 6.5 7.2 4"/><path fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" d="M9.6 5.4h6.6M3.4 12.2h13.2M3.4 15.6h13.2"/>',
  },
];

const OUTLINE_ICON =
  '<path fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" d="M4 4.5h12M4 10h12M4 15.5h8"/>';

function ToolbarIcon({ svg }: { svg: string }) {
  return (
    <svg
      className="atomic-toolbar-icon"
      viewBox="0 0 20 20"
      width="14"
      height="14"
      fill="currentColor"
      aria-hidden="true"
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}

export function Toolbar(props: {
  readOnly: boolean;
  showFormats: boolean;
  outlineOpen: boolean;
  outlineEnabled: boolean;
  formatActive?: FormatActiveMap;
  onFormat: (action: FormatAction) => void;
  onToggleOutline: () => void;
}) {
  const active = props.formatActive ?? {};
  const platform = typeof navigator === 'undefined' ? '' : navigator.platform;
  const outlineLabel = outlineToggleTitle(props.outlineOpen);
  return (
    <div className="atomic-toolbar" role="toolbar" aria-label={props.showFormats ? 'Markdown formatting' : 'Document'}>
      {props.showFormats
        ? ACTIONS.map((item) => {
            const title = formatActionTitle(item.action, platform);
            return (
              <button
                key={item.action}
                type="button"
                className="atomic-toolbar-btn"
                aria-label={title}
                title={title}
                aria-pressed={Boolean(active[item.action])}
                disabled={props.readOnly}
                onClick={() => props.onFormat(item.action)}
              >
                <ToolbarIcon svg={item.icon} />
              </button>
            );
          })
        : null}
      {props.showFormats && props.outlineEnabled ? <span className="atomic-toolbar-sep" aria-hidden="true" /> : null}
      {props.outlineEnabled ? (
        <button
          type="button"
          className="atomic-toolbar-btn"
          aria-label={outlineLabel}
          title={outlineLabel}
          aria-pressed={props.outlineOpen}
          onClick={props.onToggleOutline}
        >
          <ToolbarIcon svg={OUTLINE_ICON} />
        </button>
      ) : null}
    </div>
  );
}
