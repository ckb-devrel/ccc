export async function copyText(value: string): Promise<void> {
  if (window.isSecureContext && navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value);
    return;
  }

  const input = document.createElement("textarea");
  const activeElement = document.activeElement;
  input.value = value;
  input.readOnly = true;
  input.setAttribute("aria-hidden", "true");
  Object.assign(input.style, {
    position: "fixed",
    top: "0",
    left: "-9999px",
    opacity: "0",
  });
  document.body.append(input);
  input.select();
  input.setSelectionRange(0, value.length);

  const copied = document.execCommand("copy");
  input.remove();
  if (activeElement instanceof HTMLElement) {
    activeElement.focus({ preventScroll: true });
  }
  if (!copied) {
    throw new Error("Copy is not available in this browser");
  }
}
