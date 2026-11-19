/** Enhance native summary activation, retaining native behavior without WAAPI. */
export function animateScriptDisclosure(
  details: HTMLDetailsElement,
  motion: MediaQueryList,
) {
  const summary = details.querySelector("summary");
  if (!summary || typeof details.animate !== "function") {
    return () => {};
  }
  let animation: Animation | undefined;
  let expanded = details.open;
  const settle = () => {
    const previous = animation;
    animation = undefined;
    details.open = expanded;
    previous?.cancel();
    details.style.removeProperty("overflow");
  };
  const activate = (event: MouseEvent) => {
    // Enter/Space on native summary dispatches the same activation click.
    event.preventDefault();
    expanded = !(animation ? expanded : details.open);
    if (motion.matches) {
      settle();
      return;
    }
    // Capture painted height before cancelling, so rapid toggles reverse in place.
    const from = details.getBoundingClientRect().height;
    animation?.cancel();
    details.style.overflow = "hidden";
    details.open = true;
    const to = expanded
      ? details.getBoundingClientRect().height
      : summary.getBoundingClientRect().height;
    const next = details.animate(
      [{ height: `${from}px` }, { height: `${to}px` }],
      { duration: 180, easing: "ease-out", fill: "both" },
    );
    animation = next;
    next.onfinish = () => {
      if (animation === next) {
        settle();
      }
    };
  };
  const onMotionChange = () => {
    if (motion.matches && animation) {
      settle();
    }
  };
  summary.addEventListener("click", activate);
  motion.addEventListener("change", onMotionChange);
  return () => {
    summary.removeEventListener("click", activate);
    motion.removeEventListener("change", onMotionChange);
    if (animation) {
      settle();
    }
  };
}
