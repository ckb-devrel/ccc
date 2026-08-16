"use client";

import {
  type TextareaHTMLAttributes,
  type UIEvent,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import styles from "./module-textarea.module.css";

export function ModuleTextarea({
  className,
  onScroll,
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const textarea = useRef<HTMLTextAreaElement>(null);
  const [indicatorTop, setIndicatorTop] = useState<number>();

  const updateIndicator = (element: HTMLTextAreaElement) => {
    const maximum = element.scrollHeight - element.clientHeight;
    if (maximum <= 1) {
      setIndicatorTop(undefined);
      return;
    }

    const trackStart = 6;
    const trackEnd = 14;
    const travel = Math.max(0, element.clientHeight - trackStart - trackEnd);
    setIndicatorTop(trackStart + (element.scrollTop / maximum) * travel);
  };

  useLayoutEffect(() => {
    if (textarea.current) updateIndicator(textarea.current);
  });

  useEffect(() => {
    const element = textarea.current;
    if (!element) return;

    const observer = new ResizeObserver(() => updateIndicator(element));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

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
