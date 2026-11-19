import type { OutputOrigin } from "./output";
import type { createOutputSessionGate } from "./outputSession";

export type SendOutputMessage = (
  level: "error" | "info",
  title: string,
  msgs: unknown[],
  origin?: OutputOrigin,
) => void;

export function createOutputRun(
  sessions: ReturnType<typeof createOutputSessionGate>,
  sendMessage: SendOutputMessage,
) {
  const isCurrent = sessions.begin();
  let reportedTerminal = false;
  return {
    isCurrent,
    terminalError: (error: unknown) => {
      if (reportedTerminal) {
        return;
      }
      reportedTerminal = true;
      // sendMessage captures the original run client and wallet mode.
      sendMessage(
        "error",
        isCurrent()
          ? "Execution failed"
          : "Execution failed after wallet/network changed",
        [error],
      );
    },
    log: (level: "error" | "info", title: string, msgs: unknown[]) => {
      if (isCurrent()) {
        sendMessage(level, title, msgs, "script");
      }
    },
  };
}

export function reportUnhandledRejection(
  reason: unknown,
  timestamp: string,
  sendMessage: SendOutputMessage,
) {
  const name = reason instanceof Error ? reason.name : "Unknown Error";
  sendMessage(
    "error",
    `${timestamp} Global async error (unattributed): ${name}`,
    reason instanceof Error
      ? [reason]
      : [
          new Error("Unhandled promise rejection (original reason follows)"),
          reason,
        ],
  );
}
