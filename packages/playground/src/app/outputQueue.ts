import type { ccc } from "@ckb-ccc/ccc";
import { captureOutputEntry, type OutputOrigin } from "./output";

export type Messages = ReturnType<typeof captureOutputEntry>[];

export function createOutputQueue(publish: (batch: Messages) => void) {
  let messageId = 0;
  let queued: Messages = [];
  let timeout: ReturnType<typeof setTimeout> | undefined;

  return {
    append(
      client: ccc.Client,
      isExampleWallet: boolean,
      level: "error" | "info",
      title: string,
      msgs: unknown[],
      origin?: OutputOrigin,
    ) {
      queued.push(
        captureOutputEntry(
          level,
          title,
          msgs,
          ++messageId,
          client,
          isExampleWallet,
          origin,
        ),
      );

      timeout ??= setTimeout(() => {
        const batch = queued;
        queued = [];
        timeout = undefined;
        publish(batch);
      }, 100);
    },
    clear() {
      clearTimeout(timeout);
      timeout = undefined;
      queued = [];
    },
  };
}
