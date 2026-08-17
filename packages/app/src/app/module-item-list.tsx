"use client";

import {
  Children,
  type ComponentPropsWithoutRef,
  type ReactNode,
  type UIEvent,
  useEffect,
  useId,
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
  const content = useRef<HTMLDivElement>(null);
  const [listHeight, setListHeight] = useState<number>();
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

  useEffect(() => {
    const element = list.current;
    const contentElement = content.current;
    if (!element || !contentElement) return;

    const observer = new ResizeObserver(() => {
      updateHeight(element, contentElement, setListHeight);
      updateIndicator(element);
    });
    updateHeight(element, contentElement, setListHeight);
    updateIndicator(element);
    observer.observe(element);
    observer.observe(contentElement);
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
          style={{ height: listHeight }}
        >
          <div ref={content} className="module-item-list-content">
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

function updateHeight(
  element: HTMLDivElement,
  content: HTMLDivElement,
  setHeight: (height: number) => void,
) {
  const maximum = Number.parseFloat(getComputedStyle(element).maxHeight);
  const contentHeight = Math.ceil(content.getBoundingClientRect().height);
  setHeight(
    Number.isFinite(maximum) ? Math.min(contentHeight, maximum) : contentHeight,
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
