/** Reveal an output detail without scrolling the workbench or document ancestors. */
export function scrollOutputIntoView(element: HTMLElement | null) {
  const viewport = element?.closest<HTMLElement>("[data-output-viewport]");
  if (!element || !viewport) {
    return;
  }
  const margin = Number.parseFloat(
    element.ownerDocument.defaultView?.getComputedStyle(element)
      .scrollMarginTop ?? "0",
  );
  const top =
    viewport.scrollTop +
    element.getBoundingClientRect().top -
    viewport.getBoundingClientRect().top -
    viewport.clientTop -
    (Number.isFinite(margin) ? margin : 0);
  viewport.scrollTo({
    top: Math.min(
      Math.max(0, top),
      Math.max(0, viewport.scrollHeight - viewport.clientHeight),
    ),
    behavior: "instant",
  });
}
