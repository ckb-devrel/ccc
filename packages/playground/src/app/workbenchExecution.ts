import type { ccc } from "@ckb-ccc/ccc";
import { createCheckpointQueue } from "./checkpointQueue";
import { execute } from "./execute";
import { hasSignerNetworkMismatch, MissingWalletError } from "./execute/wallet";

type OutputRun = {
  log: Parameters<typeof execute>[3];
  isCurrent: () => boolean;
  terminalError: (error: unknown) => void;
};

export type ExecutionView = {
  isRunning: boolean;
  hasRun: boolean;
  status: string;
  walletFailure?: MissingWalletError;
  highlight?: number[];
  next?: () => void;
};

export const INITIAL_EXECUTION_VIEW: ExecutionView = {
  isRunning: false,
  hasRun: false,
  status: "Ready to run",
};

type RunOptions = {
  autoPlay: boolean;
  source: string;
  isLoading: boolean;
  signer: ccc.Signer | undefined;
  client: ccc.Client;
  clearOutput?: () => void;
  beginOutputRun: () => OutputRun;
  onStart: () => void;
  onSettled: () => void;
};

/** The workbench's execution lease is separate from the output lease. */
export function createWorkbenchExecution(
  publish: (view: ExecutionView) => void,
  runScript = execute,
) {
  let view = INITIAL_EXECUTION_VIEW;
  let active: ReturnType<typeof createCheckpointQueue> | undefined;

  function update(patch: Partial<ExecutionView>) {
    view = { ...view, ...patch };
    publish(view);
  }

  return {
    isActive: () => active !== undefined,
    async run({
      autoPlay,
      source,
      isLoading,
      signer,
      client,
      clearOutput,
      beginOutputRun,
      onStart,
      onSettled,
    }: RunOptions) {
      if (active || isLoading || hasSignerNetworkMismatch(client, signer)) {
        return;
      }
      const checkpoints = createCheckpointQueue(autoPlay, (highlight, next) => {
        update({
          highlight,
          next,
          status: next
            ? autoPlay
              ? "Rendering"
              : highlight
                ? `Paused at line ${highlight[0] + 1}`
                : "Paused at checkpoint"
            : "Executing",
        });
      });
      active = checkpoints;
      update({
        isRunning: true,
        hasRun: true,
        walletFailure: undefined,
        status: "Executing",
      });
      try {
        onStart();
        clearOutput?.();
        const output = beginOutputRun();
        try {
          await runScript(
            source,
            (position, checkpoint) =>
              checkpoint ? checkpoints.enqueue(position) : Promise.resolve(),
            signer,
            output.log,
            client,
          );
          if (active === checkpoints) {
            update({ status: "Run complete" });
          }
        } catch (error) {
          if (active === checkpoints) {
            if (error instanceof MissingWalletError && output.isCurrent()) {
              update({ walletFailure: error });
            }
            output.terminalError(error);
            update({ status: "Run failed" });
          }
        }
      } finally {
        if (active === checkpoints) {
          active = undefined;
          checkpoints.dispose();
          update({ isRunning: false, next: undefined, highlight: undefined });
          onSettled();
        }
      }
    },
    dispose() {
      active?.dispose();
      active = undefined;
    },
  };
}

export function handleExecutionShortcut(
  event: KeyboardEvent,
  dialogOpen: boolean,
  run: () => void,
) {
  if (
    (event.ctrlKey || event.metaKey) &&
    event.key === "Enter" &&
    !event.shiftKey &&
    !event.altKey &&
    !event.repeat &&
    !event.isComposing &&
    !dialogOpen
  ) {
    event.preventDefault();
    event.stopPropagation();
    run();
  }
}
