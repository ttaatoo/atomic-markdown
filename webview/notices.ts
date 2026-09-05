export function hostFailureNotice(message: string): string {
  const trimmed = message.trim();
  return trimmed || 'Something went wrong.';
}
