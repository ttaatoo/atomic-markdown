export interface HostMarkdown {
  text: string;
  generation: number;
}

/** Host `setMarkdown` / `init` with a lower generation than we have already committed. */
export function isStaleHostMarkdown(incomingGeneration: number, committedGeneration: number): boolean {
  return incomingGeneration < committedGeneration;
}

/** Keep only the newest host payload that is not older than the last committed generation. */
export function takeNewerMarkdown(
  pending: HostMarkdown | undefined,
  incoming: HostMarkdown,
  committedGeneration: number,
): HostMarkdown | undefined {
  if (isStaleHostMarkdown(incoming.generation, committedGeneration)) {
    return pending;
  }
  if (pending && incoming.generation < pending.generation) {
    return pending;
  }
  return incoming;
}

/** Prefer a queued `setMarkdown` that beat `init` (higher generation) as the mount source. */
export function markdownForMount(init: HostMarkdown, pending: HostMarkdown | undefined): HostMarkdown {
  if (!pending || pending.generation < init.generation) {
    return init;
  }
  return pending;
}
