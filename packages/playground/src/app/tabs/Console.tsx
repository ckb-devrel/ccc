import { useEffect, useMemo, useState } from "react";
import { useApp } from "../context";
import { Info, Play, X } from "lucide-react";
import React from "react";
import { enhanceDisplay } from "./enhanceDisplay";
import { ccc } from "@ckb-ccc/connector-react";

export function Console({ onRun }: { onRun?: () => void }) {
  const { messages } = useApp();
  const { client } = ccc.useCcc();
  const [flag, setFlag] = useState(0);

  useEffect(() => {
    messages.forEach((message) => {
      if (message[3]) {
        return;
      }

      (async () => {
        message[3] = await Promise.all(
          message[2].map(async (m, i) => (
            <React.Fragment key={i}>
              {await enhanceDisplay(m, client)}
            </React.Fragment>
          )),
        );
        setFlag((f) => f + 1);
      })();
    });
  }, [messages, client]);

  const consoles = useMemo(
    () =>
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      messages.map(([level, title, _, message], i) => {
        return (
          <div
            key={i}
            className={`break-all border-t-4 border-fuchsia-800 p-2 text-stone-300 ${
              level === "error" ? "bg-red-600/25" : ""
            }`}
          >
            <div
              className={`mb-2 flex items-end ${level === "error" ? "text-red-300" : ""}`}
            >
              {level === "error" ? (
                <X className="mr-1 inline" size="16" />
              ) : (
                <Info className="mr-1 inline" size="16" />
              )}
              <div className="mr-3 text-sm leading-none">
                {level.toUpperCase()}
              </div>
              <div className="leading-none text-gray-500">{title}</div>
            </div>
            {message ?? "Loading..."}
          </div>
        );
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [messages, flag],
  );

  if (consoles.length === 0) {
    return (
      <div className="flex grow flex-col items-center justify-center">
        <button className="mb-4 rounded-full bg-green-400 p-6" onClick={onRun}>
          <Play size="32" />
        </button>
        <p className="text-lg">Run code to start exploring</p>
      </div>
    );
  }

  return (
    <div className="flex max-h-dvh grow flex-col-reverse overflow-y-auto font-mono">
      <div className="flex flex-col">{consoles}</div>
    </div>
  );
}
