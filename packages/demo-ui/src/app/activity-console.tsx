"use client";

import { AlertTriangle, ChevronUp, Terminal, Trash2 } from "lucide-react";
import {
  type ReactNode,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";

export type DemoLogLevel = "error" | "info" | "success";

export type DemoLogger = (
  source: string,
  message: string,
  level?: DemoLogLevel,
) => void;

export type ActivityEntry = {
  id: number;
  level: DemoLogLevel;
  message: string;
  source: string;
  timestamp: Date;
};

export type ActivityLogStore = {
  clear: () => void;
  getSnapshot: () => ActivityEntry[];
  log: DemoLogger;
  subscribe: (listener: () => void) => () => void;
};

function createActivityLogStore(): ActivityLogStore {
  let entries: ActivityEntry[] = [];
  let nextId = 0;
  const listeners = new Set<() => void>();
  const emit = () => listeners.forEach((listener) => listener());

  return {
    clear: () => {
      if (entries.length === 0) return;
      entries = [];
      emit();
    },
    getSnapshot: () => entries,
    log: (source, message, level = "info") => {
      const entry: ActivityEntry = {
        id: nextId++,
        level,
        message: message.slice(0, 500),
        source,
        timestamp: new Date(),
      };
      entries = [...entries, entry].slice(-100);
      emit();
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

export function useActivityLog() {
  const [store] = useState(createActivityLogStore);
  const { log } = store;

  useEffect(() => {
    const handleError = (event: ErrorEvent) => {
      log("RUNTIME", safeErrorMessage(event.error ?? event.message), "error");
    };
    const handleRejection = (event: PromiseRejectionEvent) => {
      log("PROMISE", safeErrorMessage(event.reason), "error");
    };

    window.addEventListener("error", handleError);
    window.addEventListener("unhandledrejection", handleRejection);
    return () => {
      window.removeEventListener("error", handleError);
      window.removeEventListener("unhandledrejection", handleRejection);
    };
  }, [log]);

  return {
    log,
    store,
  };
}

export function ActivityConsole({
  children,
  store,
}: {
  children: ReactNode;
  store: ActivityLogStore;
}) {
  const entries = useSyncExternalStore(
    store.subscribe,
    store.getSnapshot,
    store.getSnapshot,
  );
  const [open, setOpen] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const previewLineRef = useRef<HTMLSpanElement>(null);
  const previewWidthInitialized = useRef(false);
  const [previewWidth, setPreviewWidth] = useState<number>();
  const errorCount = useMemo(
    () => entries.filter(({ level }) => level === "error").length,
    [entries],
  );
  const latest = entries[entries.length - 1];
  const previousLatest = latest
    ? (entries[entries.length - 2]?.message ?? "ACTIVITY LOG")
    : undefined;

  useLayoutEffect(() => {
    const line = previewLineRef.current;
    if (!line) return;
    const nextWidth = Math.ceil(line.scrollWidth);

    if (!previewWidthInitialized.current) {
      previewWidthInitialized.current = true;
      setPreviewWidth(nextWidth);
      return;
    }

    const frame = requestAnimationFrame(() => setPreviewWidth(nextWidth));
    return () => cancelAnimationFrame(frame);
  }, [latest?.id]);

  useEffect(() => {
    if (open) {
      listRef.current?.scrollTo({
        top: listRef.current.scrollHeight,
        behavior: "smooth",
      });
    }
  }, [entries, open]);

  return (
    <div className={`activity-console ${open ? "is-open" : ""}`}>
      <section className="activity-console-panel" aria-label="Activity log">
        <header>
          <div>
            <span className="section-index">ACTIVITY / SESSION LOG</span>
            <strong>{entries.length} EVENTS BUFFERED</strong>
          </div>
          <button
            type="button"
            disabled={entries.length === 0}
            onClick={store.clear}
          >
            <Trash2 size={13} /> Clear
          </button>
        </header>
        <div className="activity-log" ref={listRef}>
          {entries.length === 0 ? (
            <div className="activity-log-empty">No activity recorded</div>
          ) : (
            entries.map((entry) => (
              <div
                className={`activity-entry is-${entry.level}`}
                key={entry.id}
              >
                <time>{formatTime(entry.timestamp)}</time>
                <span>{entry.source}</span>
                <strong>{entry.message}</strong>
              </div>
            ))
          )}
        </div>
      </section>

      <footer className="footer-readout">
        {children}
        <button
          type="button"
          className="activity-console-toggle"
          aria-expanded={open}
          onClick={() => setOpen((current) => !current)}
        >
          {errorCount > 0 ? (
            <AlertTriangle className="activity-console-error-icon" size={13} />
          ) : (
            <Terminal size={13} />
          )}
          <span
            className="activity-console-preview"
            style={
              previewWidth === undefined ? undefined : { width: previewWidth }
            }
            aria-live="polite"
          >
            {previousLatest ? (
              <span
                key={`previous-${latest?.id}`}
                className="activity-console-preview-line is-leaving"
                aria-hidden="true"
              >
                {previousLatest}
              </span>
            ) : null}
            <span
              ref={previewLineRef}
              key={`current-${latest?.id ?? "empty"}`}
              className={`activity-console-preview-line ${previousLatest ? "is-entering" : ""}`}
            >
              {latest?.message ?? "ACTIVITY LOG"}
            </span>
          </span>
          <ChevronUp size={13} />
        </button>
      </footer>
    </div>
  );
}

function safeErrorMessage(value: unknown) {
  if (value instanceof Error) {
    return value.message || value.name;
  }
  if (typeof value === "string") {
    return value;
  }
  return "Unhandled runtime error";
}

function formatTime(date: Date) {
  return date.toLocaleTimeString("en-GB", {
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}
