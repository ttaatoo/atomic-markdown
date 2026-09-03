import { sameMarkdown, toDocumentEol, toLineFeed, type DocumentEol } from './text.ts';

export type WebviewEditPlan =
  | { type: 'drop-stale' }
  | { type: 'noop' }
  | { type: 'apply'; nextText: string };

/**
 * Decide whether a webview `edit` should hit the TextDocument.
 * Stale generations (older than the last committed host generation)
 * are dropped so an in-flight keystroke cannot rewind an external update.
 */
export function planWebviewEdit(input: {
  incomingGeneration: number;
  sessionGeneration: number;
  incomingText: string;
  documentText: string;
  eol: DocumentEol;
}): WebviewEditPlan {
  if (input.incomingGeneration < input.sessionGeneration) {
    return { type: 'drop-stale' };
  }

  const nextText = toDocumentEol(input.incomingText, input.eol);
  if (sameMarkdown(nextText, input.documentText)) {
    return { type: 'noop' };
  }

  return { type: 'apply', nextText };
}

/** Echo of the write we just applied — not an external/git edit. */
export function isEchoDocumentChange(
  documentText: string,
  lastAppliedText: string | undefined,
): boolean {
  return lastAppliedText !== undefined && sameMarkdown(documentText, lastAppliedText);
}

/** Document moved under us between planning and applyEdit; do not overwrite. */
export function shouldAbortApplyBecauseDocumentMoved(
  snapshotText: string,
  currentDocumentText: string,
): boolean {
  return !sameMarkdown(snapshotText, currentDocumentText);
}

export type AfterApplyPlan =
  | {
      type: 'failed';
      sessionGeneration: number;
      pushText: string;
      pushGeneration: number;
    }
  | {
      type: 'applied';
      sessionGeneration: number;
      catchUp?: { text: string; generation: number };
    };

/**
 * After `workspace.applyEdit`.
 * - `applied === false`: keep session generation, push canonical document
 *   text so the webview does not stay diverged (pushGeneration is high
 *   enough that the webview will not treat it as stale).
 * - Applied but document ≠ intended: concurrent edit; catch up.
 */
export function planAfterApplyEdit(input: {
  applied: boolean;
  incomingGeneration: number;
  sessionGeneration: number;
  intendedText: string;
  documentText: string;
}): AfterApplyPlan {
  const documentLf = toLineFeed(input.documentText);

  if (!input.applied) {
    return {
      type: 'failed',
      sessionGeneration: input.sessionGeneration,
      pushText: documentLf,
      pushGeneration: Math.max(input.sessionGeneration, input.incomingGeneration),
    };
  }

  const committed = Math.max(input.sessionGeneration, input.incomingGeneration);

  if (!sameMarkdown(input.intendedText, input.documentText)) {
    const generation = committed + 1;
    return {
      type: 'applied',
      sessionGeneration: generation,
      catchUp: { text: documentLf, generation },
    };
  }

  // Generation moved during applyEdit (unrelated change was forwarded)
  // but our write landed — push the document so the webview matches.
  if (input.sessionGeneration > input.incomingGeneration) {
    return {
      type: 'applied',
      sessionGeneration: committed,
      catchUp: { text: documentLf, generation: committed },
    };
  }

  return {
    type: 'applied',
    sessionGeneration: committed,
  };
}
