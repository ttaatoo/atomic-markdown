import { useEffect, useId, useRef, useState } from 'react';
import { sendShortcutHint } from './selectionFormatTooltip';
import { requestCopyText, requestSendToChat } from './sendToChat';
import { currentEditorView } from './sync';

function currentMarkdown(): string {
  return currentEditorView()?.state.doc.toString() ?? '';
}

export function DocActions(props: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { open, onOpenChange } = props;
  const [comment, setComment] = useState('');
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const copiedTimer = useRef<number | undefined>(undefined);
  const titleId = useId();
  const platform = typeof navigator === 'undefined' ? '' : navigator.platform;

  useEffect(() => {
    if (open) {
      inputRef.current?.focus();
    }
  }, [open]);

  useEffect(() => {
    return () => {
      if (copiedTimer.current) {
        window.clearTimeout(copiedTimer.current);
      }
    };
  }, []);

  const sendGlobal = () => {
    const text = currentMarkdown();
    requestSendToChat({
      mode: 'global',
      text,
      from: 0,
      to: text.length,
      comment,
    });
  };

  const copyDocument = () => {
    requestCopyText(currentMarkdown());
    setCopied(true);
    if (copiedTimer.current) {
      window.clearTimeout(copiedTimer.current);
    }
    copiedTimer.current = window.setTimeout(() => {
      setCopied(false);
    }, 1200);
  };

  return (
    <div className="doc-actions">
      <div className="doc-pills">
        <button
          type="button"
          className="doc-pill"
          data-pill="global"
          aria-pressed={open}
          onClick={() => onOpenChange(!open)}
        >
          <GlobeIcon />
          <span>Global comment</span>
        </button>
        <button
          type="button"
          className="doc-pill"
          data-pill="copy"
          data-copied={copied ? 'true' : 'false'}
          onClick={copyDocument}
        >
          {copied ? <CheckIcon /> : <CopyIcon />}
          <span>{copied ? 'Copied' : 'Copy'}</span>
        </button>
      </div>
      <div
        className="selection-card doc-global-card"
        hidden={!open}
        data-expanded={expanded ? 'true' : 'false'}
        role="dialog"
        aria-labelledby={titleId}
      >
        <div className="selection-card-head">
          <div className="selection-card-title selection-card-title-plain" id={titleId}>
            Global Comment
          </div>
          <div className="selection-card-head-actions">
            <button
              type="button"
              className="selection-card-icon-btn"
              aria-label="Expand comment"
              aria-pressed={expanded}
              onClick={() => setExpanded((value) => !value)}
            >
              <ExpandIcon />
            </button>
            <button
              type="button"
              className="selection-card-icon-btn"
              aria-label="Close"
              onClick={() => onOpenChange(false)}
            >
              <CloseIcon />
            </button>
          </div>
        </div>
        <textarea
          ref={inputRef}
          className="selection-card-input"
          rows={expanded ? 8 : 3}
          placeholder="Add a global comment…"
          aria-label="Global comment"
          value={comment}
          onChange={(event) => setComment(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              event.preventDefault();
              event.stopPropagation();
              onOpenChange(false);
              return;
            }
            if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
              event.preventDefault();
              sendGlobal();
            }
          }}
        />
        <div className="selection-card-foot">
          <span className="selection-card-hint">{sendShortcutHint(platform)}</span>
          <button type="button" className="selection-card-send" onClick={sendGlobal}>
            Add
          </button>
        </div>
      </div>
    </div>
  );
}

function GlobeIcon() {
  return (
    <svg viewBox="0 0 20 20" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="10" cy="10" r="6" />
      <path d="M4 10h12M10 4c2 2.2 2 9.8 0 12M10 4c-2 2.2-2 9.8 0 12" />
    </svg>
  );
}

function CopyIcon() {
  return (
    <svg viewBox="0 0 20 20" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="7" y="7" width="8" height="8" rx="1.2" />
      <path d="M5 13V5h8" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 20 20" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 10.2 8.4 13.4 15 6.6" />
    </svg>
  );
}

function ExpandIcon() {
  return (
    <svg viewBox="0 0 20 20" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M8 4H4v4M12 16h4v-4M4 8 8 4M16 12l-4 4" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg viewBox="0 0 20 20" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 5l10 10M15 5 5 15" />
    </svg>
  );
}
