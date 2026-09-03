export function addSession<T>(map: Map<string, T[]>, uri: string, session: T): void {
  const list = map.get(uri);
  if (list) {
    list.push(session);
    return;
  }
  map.set(uri, [session]);
}

export function removeSession<T>(map: Map<string, T[]>, uri: string, session: T): boolean {
  const list = map.get(uri);
  if (!list) {
    return false;
  }
  const next = list.filter((item) => item !== session);
  if (next.length === list.length) {
    return false;
  }
  if (next.length === 0) {
    map.delete(uri);
  } else {
    map.set(uri, next);
  }
  return true;
}

export function sessionsForUri<T>(map: Map<string, T[]>, uri: string): readonly T[] {
  return map.get(uri) ?? [];
}

/** Which sessions should receive an external/git/text-editor document change. */
export function sessionsNeedingForward<T extends { pendingEcho: import('./sync').VersionedEcho | undefined }>(
  sessions: readonly T[],
  documentText: string,
  documentVersion: number,
  consumeEcho: (
    echo: T['pendingEcho'],
    documentText: string,
    documentVersion: number,
  ) => { isEcho: boolean },
): T[] {
  return sessions.filter((session) => !consumeEcho(session.pendingEcho, documentText, documentVersion).isEcho);
}
