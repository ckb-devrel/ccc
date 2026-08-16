"use client";

import {
  Children,
  type ComponentPropsWithoutRef,
  type ReactNode,
  type UIEvent,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from "react";

export function ModuleItemList({
  children,
  count,
  emptyText,
  expandedRowsOnMobile = false,
  hasMore = false,
  label,
  loadingMore = false,
  onLoadMore,
  selection = false,
}: {
  children: ReactNode;
  count: number;
  emptyText: string;
  expandedRowsOnMobile?: boolean;
  hasMore?: boolean;
  label: string;
  loadingMore?: boolean;
  onLoadMore?: () => void;
  selection?: boolean;
}) {
  const labelId = useId();
  const empty = Children.count(children) === 0;
  const list = useRef<HTMLDivElement>(null);
  const [indicatorTop, setIndicatorTop] = useState<number>();

  const updateIndicator = (element: HTMLDivElement) => {
    const maximum = element.scrollHeight - element.clientHeight;
    if (maximum <= 1) {
      setIndicatorTop(undefined);
      return;
    }

    const trackInset = 7;
    const travel = Math.max(0, element.clientHeight - trackInset * 2);
    setIndicatorTop(trackInset + (element.scrollTop / maximum) * travel);
  };

  useLayoutEffect(() => {
    if (list.current) updateIndicator(list.current);
  });

  useEffect(() => {
    const element = list.current;
    if (!element) return;

    const observer = new ResizeObserver(() => updateIndicator(element));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const handleScroll = (event: UIEvent<HTMLDivElement>) => {
    updateIndicator(event.currentTarget);
  };

  return (
    <div className="module-field module-field-wide">
      <span id={labelId}>
        {label} / {count.toString().padStart(2, "0")}
        {hasMore ? "+" : ""}
      </span>
      <div className="module-item-list-viewport">
        <div
          ref={list}
          className={
            expandedRowsOnMobile
              ? "module-item-list is-expanded-mobile"
              : "module-item-list"
          }
          role={selection ? "listbox" : "group"}
          aria-labelledby={labelId}
          onScroll={handleScroll}
        >
          {empty ? (
            <span className="module-item-empty">{emptyText}</span>
          ) : (
            children
          )}
          {hasMore && onLoadMore ? (
            <div className="module-item-list-more-row" role="presentation">
              <button
                type="button"
                className="module-item-list-more"
                disabled={loadingMore}
                onClick={onLoadMore}
              >
                {loadingMore ? "Loading…" : "Load more"}
              </button>
            </div>
          ) : null}
        </div>
        {indicatorTop === undefined ? null : (
          <span
            className="module-item-list-indicator"
            style={{ top: indicatorTop }}
            aria-hidden="true"
          />
        )}
      </div>
    </div>
  );
}

export function ModuleItem({
  children,
  className,
  selected,
  ...props
}: Omit<ComponentPropsWithoutRef<"button">, "aria-selected" | "role"> & {
  selected?: boolean;
}) {
  return (
    <button
      {...props}
      type="button"
      className={["module-item", className, selected && "is-selected"]
        .filter(Boolean)
        .join(" ")}
      role={selected === undefined ? undefined : "option"}
      aria-selected={selected}
    >
      {children}
    </button>
  );
}

export function ModuleSelectionItem({
  description,
  label,
  ...props
}: Omit<
  ComponentPropsWithoutRef<typeof ModuleItem>,
  "children" | "className"
> & {
  description: string;
  label: string;
}) {
  return (
    <ModuleItem {...props} className="module-selection-item">
      <span className="module-selection-value">
        <strong>{label}</strong>
        <small>{description}</small>
      </span>
      <span className="module-selection-state" aria-hidden="true" />
    </ModuleItem>
  );
}
