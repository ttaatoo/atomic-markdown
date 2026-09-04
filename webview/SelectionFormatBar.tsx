import type { Ref } from 'react';
import type { FormatAction } from '../src/protocol.ts';
import type { FormatActiveMap } from './formatActive.ts';
import { SELECTION_FORMAT_ACTIONS } from './selectionBar.ts';
import { formatActionTitle } from './toolbarLabels.ts';

const INLINE_ICONS: Partial<Record<FormatAction, string>> = {
  bold: '<path d="M5 4h6.2c2.3 0 3.8 1.4 3.8 3.3 0 1.4-.8 2.5-2.1 3 .9.3 2.6 1.3 2.6 3.2 0 2.2-1.7 3.5-4.2 3.5H5V4zm2.6 5.4h3.3c1 0 1.6-.6 1.6-1.4S11.9 6.6 10.9 6.6H7.6v2.8zm0 5.4h3.7c1.2 0 1.9-.6 1.9-1.6s-.7-1.6-1.9-1.6H7.6V14.8z"/>',
  italic: '<path d="M9.2 4h6.1v1.8H12.4l-2.6 8.4h2.7V16H6.3v-1.8h2.8L11.7 5.8H9.2V4z"/>',
  strike:
    '<path fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" d="M4 10h12"/><path fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" d="M7.2 13.8c.5 1.1 1.6 1.8 3 1.8 2 0 3.4-1.1 3.4-2.7 0-2.2-2.2-2.6-4.4-3.2C7.2 9.1 5.8 8.3 5.8 6.5 5.8 4.7 7.4 3.5 9.8 3.5c1.6 0 2.8.6 3.5 1.6"/>',
  inlineCode:
    '<path fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" d="M6.2 5.5 2.8 10l3.4 4.5M13.8 5.5 17.2 10l-3.4 4.5M11.2 3.8 8.8 16.2"/>',
  link: '<path fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" d="M8.2 11.8 6.4 13.6a2.4 2.4 0 0 0 3.4 3.4l2.4-2.4M11.8 8.2l1.8-1.8a2.4 2.4 0 1 1 3.4 3.4l-2.4 2.4M8.7 11.3l2.6-2.6"/>',
};

function FormatIcon({ svg }: { svg: string }) {
  return (
    <svg
      className="selection-format-icon"
      viewBox="0 0 20 20"
      width="14"
      height="14"
      fill="currentColor"
      aria-hidden="true"
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}

export function SelectionFormatBar(props: {
  top: number;
  left: number;
  barRef?: Ref<HTMLDivElement>;
  formatActive?: FormatActiveMap;
  onFormat: (action: FormatAction) => void;
  onPointerEnter: () => void;
  onPointerLeave: () => void;
}) {
  const active = props.formatActive ?? {};
  const platform = typeof navigator === 'undefined' ? '' : navigator.platform;
  return (
    <div
      ref={props.barRef}
      className="selection-format-bar"
      role="toolbar"
      aria-label="Format selection"
      style={{ top: props.top, left: props.left }}
      onMouseDown={(event) => event.preventDefault()}
      onPointerEnter={props.onPointerEnter}
      onPointerLeave={props.onPointerLeave}
    >
      {SELECTION_FORMAT_ACTIONS.map((action) => {
        const title = formatActionTitle(action, platform);
        const icon = INLINE_ICONS[action];
        return (
          <button
            key={action}
            type="button"
            className="selection-format-btn"
            aria-label={title}
            title={title}
            aria-pressed={Boolean(active[action])}
            onClick={() => props.onFormat(action)}
          >
            {icon ? <FormatIcon svg={icon} /> : action}
          </button>
        );
      })}
    </div>
  );
}
