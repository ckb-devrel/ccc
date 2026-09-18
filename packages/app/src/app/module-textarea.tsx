"use client";

import {
  type TextareaHTMLAttributes,
  type UIEvent,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import styles from "./module-textarea.module.css";

export function ModuleTextarea({
  className,
  defaultValue,
  onInput,
  onScroll,
  value,
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const textarea = useRef<HTMLTextAreaElement>(null);
  const indicatorFrame = useRef(0);
  const lastIndicatorTop = useRef<number | undefined>(undefined);
  const [indicatorTop, setIndicatorTop] = useState<number>();

  const updateIndicator = useCallback((element: HTMLTextAreaElement) => {
    if (indicatorFrame.current !== 0) {
      return;
    }

    indicatorFrame.current = requestAnimationFrame(() => {
      indicatorFrame.current = 0;
      const maximum = element.scrollHeight - element.clientHeight;
      let nextTop: number | undefined;
      if (maximum > 1) {
        const trackStart = 6;
        const trackEnd = 14;
        const travel = Math.max(
          0,
          element.clientHeight - trackStart - trackEnd,
        );
        nextTop = trackStart + (element.scrollTop / maximum) * travel;
      }

      if (nextTop === lastIndicatorTop.current) {
        return;
      }

      lastIndicatorTop.current = nextTop;
      setIndicatorTop(nextTop);
    });
  }, []);

  useLayoutEffect(() => {
    if (textarea.current) updateIndicator(textarea.current);
  }, [defaultValue, updateIndicator, value]);

  useEffect(() => {
    const element = textarea.current;
    if (!element) return;

    const observer = new ResizeObserver(() => updateIndicator(element));
    observer.observe(element);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(indicatorFrame.current);
      indicatorFrame.current = 0;
    };
  }, [updateIndicator]);

  const handleScroll = (event: UIEvent<HTMLTextAreaElement>) => {
    updateIndicator(event.currentTarget);
    onScroll?.(event);
  };

  return (
    <div className={styles.root}>
      <textarea
        {...props}
        ref={textarea}
        className={className}
        defaultValue={defaultValue}
        value={value}
        onInput={(event) => {
          updateIndicator(event.currentTarget);
          onInput?.(event);
        }}
        onScroll={handleScroll}
      />
      <span className={styles.resizer} aria-hidden="true" />
      {indicatorTop === undefined ? null : (
        <span
          className={styles.indicator}
          style={{ top: indicatorTop }}
          aria-hidden="true"
        />
      )}
    </div>
  );
}
