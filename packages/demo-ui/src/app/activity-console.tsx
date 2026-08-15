"use client";

import { AlertTriangle, ChevronUp, Terminal, Trash2 } from "lucide-react";
import {
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

export type DemoLogLevel = "error" | "info" | "success";

export type DemoLogger = (
  source: string,
  message: string,
  level?: DemoLogLevel,
) => void;

type ActivityEntry = {
  id: number;
  level: DemoLogLevel;
  message: string;
  source: string;
  timestamp: Date;
};

export function useActivityLog() {
  const nextId = useRef(0);
  const [entries, setEntries] = useState<ActivityEntry[]>([]);

  const log = useCallback<DemoLogger>((source, message, level = "info") => {
    const entry: ActivityEntry = {
      id: nextId.current++,
      level,
      message: message.slice(0, 500),
      source,
      timestamp: new Date(),
    };
    setEntries((current) => [...current, entry].slice(-100));
  }, []);

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
    clear: useCallback(() => setEntries([]), []),
    entries,
    log,
  };
}

export function ActivityConsole({
  children,
  entries,
  onClear,
}: {
  children: ReactNode;
  entries: ActivityEntry[];
  onClear: () => void;
}) {
  const [open, setOpen] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const errorCount = useMemo(
    () => entries.filter(({ level }) => level === "error").length,
    [entries],
  );
  const latest = entries[entries.length - 1];

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
            onClick={onClear}
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
            <AlertTriangle size={13} />
          ) : (
            <Terminal size={13} />
          )}
          <span>{latest?.message ?? "ACTIVITY LOG"}</span>
          {errorCount > 0 ? <b>{errorCount}</b> : null}
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
