export function syncThemeFromWorkbench(): void {
  const light =
    document.body.classList.contains('vscode-light') ||
    document.body.classList.contains('vscode-high-contrast-light');
  document.documentElement.dataset.theme = light ? 'light' : 'dark';
}

export function observeWorkbenchTheme(): () => void {
  syncThemeFromWorkbench();
  const observer = new MutationObserver(syncThemeFromWorkbench);
  observer.observe(document.body, { attributes: true, attributeFilter: ['class'] });
  return () => observer.disconnect();
}
