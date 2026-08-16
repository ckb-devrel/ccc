"use client";

import {
  type TextareaHTMLAttributes,
  type UIEvent,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";

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
    <div className="module-textarea">
      <textarea
        {...props}
        ref={textarea}
        className={className}
        onScroll={handleScroll}
      />
      {indicatorTop === undefined ? null : (
        <span
          className="module-textarea-indicator"
          style={{ top: indicatorTop }}
          aria-hidden="true"
        />
      )}
    </div>
  );
}
