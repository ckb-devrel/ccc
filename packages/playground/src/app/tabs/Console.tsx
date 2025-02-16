import { useMemo } from "react";
import { useApp } from "../context";
import { Info, X } from "lucide-react";

export function Console() {
  const { messages } = useApp();

  const consoles = useMemo(
    () =>
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      messages.map(([level, _, message], i) => (
        <div
          key={i}
          className={`break-all border-t border-fuchsia-800 p-2 ${
            level === "error" ? "bg-red-600/25 text-red-300" : "text-stone-300"
          }`}
        >
          {level === "error" ? (
            <X className="mr-2 inline" size="16" />
          ) : (
            <Info className="mr-2 inline" size="16" />
          )}
          {message}
        </div>
      )),
    [messages],
  );

  return (
    <div className="flex max-h-dvh grow flex-col-reverse overflow-y-auto font-mono">
      <div className="flex flex-col">{consoles}</div>
    </div>
  );
}
