import { ccc } from "@ckb-ccc/core";

interface WorkerInitializeOptions {
	inputBuffer: SharedArrayBuffer;
	outputBuffer: SharedArrayBuffer;
	logLevel: string;
}

interface SSRIExecutorWorkerInitializeOptions extends WorkerInitializeOptions {
	rpcUrl: string;
};

interface SSRIExecutorFunctionCall {
	initiator: "js" | "wasm";
	name: string;
	args: unknown[];
	inputBuffer: SharedArrayBuffer;
	outputBuffer: SharedArrayBuffer;
};

type TraceRecord = {
	type: "DownloadBlock";
	start_at: number;
	count: number;
	matched_count: number;
}

export {
	SSRIExecutorFunctionCall,
	WorkerInitializeOptions,
	SSRIExecutorWorkerInitializeOptions,
	TraceRecord,
}

export interface SSRIExecutorResult {
	content: ccc.Hex;
	cellDeps: ccc.OutPointLike[];
}
