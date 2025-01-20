import { useMemo } from "react";
import { useApp } from "../context";
import { Info, X } from "lucide-react";
import { formatTimestamp } from "../utils";

export function Console() {
  const { messages } = useApp();

  const consoles = useMemo(
    () =>
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      messages.map(([level, _, message, timestamp], i) => (
        <div
          key={i}
          className={`border-t border-fuchsia-800 p-2 break-all ${
            level === "error" ? "text-red-300 bg-red-600/25" : "text-stone-300"
          }`}
        >
          {level === "error" ? (
            <X className="inline mr-2" size="16" />
          ) : (
            <Info className="inline mr-2" size="16" />
          )}
          <span className="text-[#8F8F8F] pr-1">
            {formatTimestamp(timestamp)}
          </span>
          {message}
        </div>
      )),
    [messages]
  );

  return (
    <div className="flex flex-col-reverse grow overflow-y-auto max-h-dvh font-mono text-sm">
      <div className="flex flex-col">{consoles}</div>
    </div>
  );
}
