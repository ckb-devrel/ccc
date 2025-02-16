import { ccc } from "@ckb-ccc/core";

interface WorkerInitializeOptions {
  inputBuffer: SharedArrayBuffer;
  outputBuffer: SharedArrayBuffer;
  logLevel: string;
}

interface SSRIExecutorWorkerInitializeOptions extends WorkerInitializeOptions {
  rpcUrl: string;
}

interface SSRIExecutorFunctionCall {
  initiator: "js" | "wasm";
  name: string;
  args: unknown[];
  inputBuffer: SharedArrayBuffer;
  outputBuffer: SharedArrayBuffer;
}

type TraceRecord = {
  type: "DownloadBlock";
  start_at: number;
  count: number;
  matched_count: number;
};

export {
  SSRIExecutorFunctionCall,
  SSRIExecutorWorkerInitializeOptions,
  TraceRecord,
  WorkerInitializeOptions,
};

export interface SSRIExecutorResult {
  content: ccc.Hex;
  cellDeps: ccc.OutPointLike[];
}
