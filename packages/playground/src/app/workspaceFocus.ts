export function restoreWorkspaceFocus(
  original: HTMLElement | null,
  fallback: HTMLElement | null | undefined,
) {
  const target = original?.isConnected ? original : fallback;
  target?.focus({ preventScroll: true });
}
