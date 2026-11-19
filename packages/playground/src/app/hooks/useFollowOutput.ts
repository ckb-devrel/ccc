import { useCallback, useEffect, useRef, useState } from "react";

export function shouldResumeFollowing(
  following: boolean,
  userInitiated: boolean,
  previousTop: number,
  top: number,
  remaining: number,
) {
  return !following && userInitiated && top > previousTop && remaining <= 2;
}

/** Only explicit inspection controls pause following, not tabs or splitters. */
export function isOutputInspectionTarget(target: Pick<Element, "closest">) {
  return target.closest("button[data-output-inspect], summary") !== null;
}

/** Follow only the output panel, never scroll the document or editor. */
export function useFollowOutput(revision: string, isRunning = false) {
  const [follow, setFollow] = useState(true);
  const following = useRef(true);
  const viewport = useRef<HTMLDivElement>(null);
  const content = useRef<HTMLDivElement>(null);
  const userScroll = useRef(false);
  const previousTop = useRef(0);
  const touchY = useRef<number | undefined>(undefined);
  const resumeFollow = useCallback(() => {
    following.current = true;
    setFollow(true);
  }, []);
  const pause = useCallback(() => {
    following.current = false;
    const element = viewport.current;
    if (element) {
      // Cancel an in-flight smooth scroll as soon as the reader takes control.
      element.scrollTo({ top: element.scrollTop, behavior: "instant" });
    }
    userScroll.current = false;
    previousTop.current = element?.scrollTop ?? 0;
    setFollow(false);
  }, []);

  useEffect(() => {
    if (isRunning) {
      userScroll.current = false;
      // A new execution intentionally returns to following its fresh output.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      resumeFollow();
    }
  }, [isRunning, resumeFollow]);

  useEffect(() => {
    const element = viewport.current;
    const contents = content.current;
    if (!element || !contents || !follow) {
      return;
    }
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let frame = 0;
    const scroll = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        // Capture-phase inspection pauses synchronously, before React effects
        // clean up a pending observer/frame from the previous render.
        if (!following.current) {
          return;
        }
        element.scrollTo({
          top: element.scrollHeight,
          behavior: reducedMotion.matches ? "instant" : "smooth",
        });
      });
    };
    scroll();
    const observer = new ResizeObserver(scroll);
    observer.observe(contents);
    observer.observe(element);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [revision, follow]);

  return {
    follow,
    resumeFollow,
    toggleFollow: () => (follow ? pause() : resumeFollow()),
    viewport,
    content,
    inputHandlers: {
      onClickCapture: (event: React.MouseEvent<HTMLDivElement>) => {
        if (
          event.target instanceof Element &&
          isOutputInspectionTarget(event.target)
        ) {
          // Also covers keyboard-generated clicks on buttons and summaries.
          pause();
        }
      },
      onScroll: (event: React.UIEvent<HTMLDivElement>) => {
        const element = event.currentTarget;
        const top = element.scrollTop;
        const remaining = element.scrollHeight - element.clientHeight - top;
        // Only a reader-initiated downward movement can resume. Async rendering
        // and completion of our own smooth scroll must not undo a manual pause.
        if (
          shouldResumeFollowing(
            follow,
            userScroll.current,
            previousTop.current,
            top,
            remaining,
          )
        ) {
          userScroll.current = false;
          resumeFollow();
        }
        previousTop.current = top;
      },
      onWheel: (event: React.WheelEvent<HTMLDivElement>) => {
        if (event.deltaY < 0) {
          pause();
        } else if (event.deltaY > 0) {
          userScroll.current = true;
        }
      },
      onKeyDown: (event: React.KeyboardEvent<HTMLDivElement>) => {
        // Keys used by nested splitters, tabs and disclosures are not scroll intent.
        if (event.target !== event.currentTarget) {
          return;
        }
        if (
          ["ArrowUp", "PageUp", "Home"].includes(event.key) ||
          (event.key === " " && event.shiftKey)
        ) {
          pause();
        } else if (["ArrowDown", "PageDown", "End", " "].includes(event.key)) {
          userScroll.current = true;
        }
      },
      onPointerDown: (event: React.PointerEvent<HTMLDivElement>) => {
        const element = event.currentTarget;
        if (
          event.clientX >=
          element.getBoundingClientRect().left + element.clientWidth
        ) {
          pause();
          userScroll.current = true;
        }
      },
      onTouchStart: (event: React.TouchEvent<HTMLDivElement>) => {
        touchY.current = event.touches[0]?.clientY;
      },
      onTouchMove: (event: React.TouchEvent<HTMLDivElement>) => {
        const y = event.touches[0]?.clientY;
        if (
          y !== undefined &&
          touchY.current !== undefined &&
          y > touchY.current + 3
        ) {
          pause();
        } else if (
          y !== undefined &&
          touchY.current !== undefined &&
          y < touchY.current
        ) {
          userScroll.current = true;
        }
        // Retain the anchor across small downward finger movements so a slow
        // upward content scroll eventually crosses the jitter threshold.
        if (
          y === undefined ||
          touchY.current === undefined ||
          y < touchY.current ||
          y > touchY.current + 3
        ) {
          touchY.current = y;
        }
      },
    },
  };
}
