import { ccc } from "@ckb-ccc/core";

interface WorkerInitializeOptions {
  logLevel: string;
}

interface SSRIExecutorWorkerInitializeOptions extends WorkerInitializeOptions {
  logLevel: "trace" | "debug" | "info" | "error";
  channelName: string;
  rpcUrl: string;
  network: "testnet" | "mainnet";
}

interface SSRIExecutorFunctionCall {
  name: string;
  args: unknown[];
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

export interface BroadcastChannelMessagePacket {
  senderName: string;
  targetName: string;
  messageLabel: string;
  dataTypeHint: string;
  data: unknown;
}

export interface GetCellsArguments {
  searchKey: {
    script: {
      args: ccc.HexLike;
      code_hash: ccc.HexLike;
      hash_type: ccc.HashTypeLike;
    };
    scriptType: "lock" | "type";
    scriptSearchMode: "prefix" | "exact" | "partial";
    filter?: {
      outputData: ccc.HexLike;
      outputDataSearchMode: "prefix" | "exact" | "partial";
    };
    withData?: boolean;
  };
  order: "asc" | "desc";
  limit: number;
  afterCursor?: string | undefined;
}

export interface GetTransactionArguments {
  tx_hash: ccc.HexLike;
}
