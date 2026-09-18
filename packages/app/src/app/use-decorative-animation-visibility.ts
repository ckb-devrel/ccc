"use client";

import { type RefObject, useEffect } from "react";

const ACTIVE_ATTRIBUTE = "data-decorative-effects-active";

export function useDecorativeAnimationVisibility(
  ref: RefObject<HTMLElement | null>,
) {
  useEffect(() => {
    const element = ref.current;
    if (!element) {
      return;
    }

    const canObserve = "IntersectionObserver" in window;
    let intersecting = !canObserve;
    const sync = () => {
      element.toggleAttribute(
        ACTIVE_ATTRIBUTE,
        intersecting && !document.hidden,
      );
    };
    const observer = canObserve
      ? new IntersectionObserver(([entry]) => {
          intersecting = entry?.isIntersecting ?? false;
          sync();
        })
      : undefined;

    sync();
    observer?.observe(element);
    document.addEventListener("visibilitychange", sync);
    return () => {
      observer?.disconnect();
      document.removeEventListener("visibilitychange", sync);
      element.removeAttribute(ACTIVE_ATTRIBUTE);
    };
  }, [ref]);
}
