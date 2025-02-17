import { ccc } from "@ckb-ccc/core";
import { cccA } from "@ckb-ccc/core/advanced";
import { Mutex } from "async-mutex";
import ExecutorWorker from "./executor.worker.js";
import {
  SSRIExecutorResult,
  SSRIExecutorWorkerInitializeOptions,
  TraceRecord,
} from "./types.js";
import { getMethodPath } from "./utils.js";

export type ContextTransaction = {
  script?: ccc.ScriptLike | null;
  cell?: Omit<ccc.CellLike, "outPoint"> | null;
  tx: ccc.TransactionLike;
};

export type ContextCell = {
  script?: ccc.ScriptLike | null;
  cell: Omit<ccc.CellLike, "outPoint">;
  tx?: undefined | null;
};

export type ContextScript = {
  script: ccc.ScriptLike;
  cell?: undefined | null;
  tx?: undefined | null;
};

export class ExecutorErrorUnknown extends Error {
  constructor(msg?: string) {
    super(msg);
  }
}

export class ExecutorErrorExecutionFailed extends Error {
  constructor(msg?: string) {
    super(msg);
  }
}

export class ExecutorErrorDecode extends Error {
  constructor(msg?: string) {
    super(msg);
  }
}

export type ContextCode =
  | undefined
  | {
      script?: undefined | null;
      cell?: undefined | null;
      tx?: undefined | null;
    };

export class ExecutorResponse<T> {
  constructor(
    public readonly res: T,
    public readonly cellDeps: ccc.OutPoint[],
  ) {}

  static new<T>(res: T, cellDeps?: ccc.OutPointLike[] | null) {
    return new ExecutorResponse(res, cellDeps?.map(ccc.OutPoint.from) ?? []);
  }

  map<U>(fn: (res: T) => U): ExecutorResponse<U> {
    try {
      return new ExecutorResponse(fn(this.res), this.cellDeps);
    } catch (err) {
      throw new ExecutorErrorDecode(JSON.stringify(err));
    }
  }
}

/**
 * Represents an SSRI executor.
 */
export abstract class Executor {
  abstract runScript(
    codeOutPoint: ccc.OutPointLike,
    method: string,
    args: ccc.HexLike[],
    context?: ContextCode | ContextScript | ContextCell | ContextTransaction,
  ): Promise<ExecutorResponse<ccc.Hex>>;

  async runScriptTry(
    codeOutPoint: ccc.OutPointLike,
    method: string,
    args: ccc.HexLike[],
    context?: ContextCode | ContextScript | ContextCell | ContextTransaction,
  ): Promise<ExecutorResponse<ccc.Hex> | undefined> {
    try {
      return await this.runScript(codeOutPoint, method, args, context);
    } catch (err) {
      if (err instanceof ExecutorErrorExecutionFailed) {
        return undefined;
      }
      throw err;
    }
  }
}

export class ExecutorJsonRpc extends Executor {
  public readonly requestor: ccc.RequestorJsonRpc;

  /**
   * Creates an instance of SSRI executor through Json RPC.
   * @param {string} [url] - The external server URL.
   */
  constructor(
    url: string,
    config?: ccc.RequestorJsonRpcConfig & { requestor?: ccc.RequestorJsonRpc },
  ) {
    super();

    this.requestor =
      config?.requestor ??
      new ccc.RequestorJsonRpc(url, config, (errAny) => {
        if (
          typeof errAny !== "object" ||
          errAny === null ||
          !("code" in errAny) ||
          typeof errAny.code !== "number"
        ) {
          throw new ExecutorErrorUnknown(JSON.stringify(errAny));
        }

        if (errAny.code === 1003 || errAny.code === 1004) {
          if ("message" in errAny && typeof errAny.message === "string") {
            throw new ExecutorErrorExecutionFailed(errAny.message);
          }
          throw new ExecutorErrorExecutionFailed();
        }

        if ("message" in errAny && typeof errAny.message === "string") {
          throw new ExecutorErrorUnknown(errAny.message);
        }
        throw new ExecutorErrorUnknown();
      });
  }

  get url() {
    return this.requestor.url;
  }

  /* Calls a method on the SSRI executor through SSRI Server.
   * @param codeOutPoint - The code OutPoint.
   * @param method - The SSRI method.
   * @param args - The arguments for the method.
   * @param context - The SSRI context for the method.
   * @param context.script - The script level parameters.
   * @param context.cell - The cell level parameters. Take precedence over script.
   * @param context.transaction - The transaction level parameters. Take precedence over cell.
   * @returns The result of the call.
   */
  async runScript(
    codeOutPoint: ccc.OutPointLike,
    method: string,
    args: ccc.HexLike[],
    context?: ContextCode | ContextScript | ContextCell | ContextTransaction,
  ): Promise<ExecutorResponse<ccc.Hex>> {
    const code = ccc.OutPoint.from(codeOutPoint);
    const [rpcMethod, rpcContext] = (() => {
      if (context?.tx) {
        const tx = ccc.Transaction.from(context.tx);
        return [
          "run_script_level_transaction",
          [
            {
              inner: cccA.JsonRpcTransformers.transactionFrom(tx),
              hash: tx.hash(),
            },
          ],
        ];
      }
      if (context?.cell) {
        return [
          "run_script_level_cell",
          [
            {
              cell_output: cccA.JsonRpcTransformers.cellOutputFrom(
                ccc.CellOutput.from(context.cell.cellOutput),
              ),
              hex_data: ccc.hexFrom(context.cell.outputData),
            },
          ],
        ];
      }
      if (context?.script) {
        return [
          "run_script_level_script",
          [cccA.JsonRpcTransformers.scriptFrom(context.script)],
        ];
      }
      return ["run_script_level_code", []];
    })();

    const { content, cell_deps } = (await this.requestor.request(rpcMethod, [
      code.txHash,
      Number(code.index),
      [getMethodPath(method), ...args.map(ccc.hexFrom)],
      ...rpcContext,
    ])) as { content: ccc.Hex; cell_deps: cccA.JsonRpcOutPoint[] };

    return ExecutorResponse.new(
      content,
      cell_deps.map(cccA.JsonRpcTransformers.outPointTo),
    );
  }
}

const DEFAULT_BUFFER_SIZE = 50 * (1 << 20);

export class ExecutorWASM extends Executor {
  private executorWorker: Worker;
  private inputBuffer: SharedArrayBuffer;
  private outputBuffer: SharedArrayBuffer;
  private commandInvokeLock: Mutex;
  private traceLogBuffer: SharedArrayBuffer;
  private stopping: boolean = false;
  private traceLogCallback: ((value: TraceRecord) => void) | null = null;
  public readonly url: string;
  public started = false;

  /**
   * Creates an instance of SSRI executor through Json RPC.
   * @param {string} [url] - The external server URL.
   */
  constructor(
    url: string,
    inputBufferSize = DEFAULT_BUFFER_SIZE,
    outputBufferSize = DEFAULT_BUFFER_SIZE,
  ) {
    super();

    this.executorWorker = new ExecutorWorker();
    this.inputBuffer = new SharedArrayBuffer(inputBufferSize);
    this.outputBuffer = new SharedArrayBuffer(outputBufferSize);
    this.traceLogBuffer = new SharedArrayBuffer(10 * 1024);
    this.commandInvokeLock = new Mutex();
    // this.executorWorker.onmessage = (event: MessageEvent) => {
    //     // Call the Wasm function to handle worker responses
    //     wasmModule.handle_worker_response(event.data);
    // };

    // Make the worker accessible to Wasm
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (self as any).post_message_to_worker = (message: string) => {
      if (this.executorWorker) {
        this.executorWorker.postMessage(message);
      }
    };
    this.url = url;
  }

  async confirmStarted(): Promise<boolean> {
    if (!this.started) {
      await this.start("debug", this.url);
      this.started = true;
    }
    return this.started;
  }

  /**
   * Set a callback to receive trace log records
   * @param cb The callback
   */
  setTraceLogCallback(cb: (value: TraceRecord) => void) {
    this.traceLogCallback = cb;
  }

  /**
   * Start the SSRI Executor WASM.
   * @param logLevel Log Level for the SSRI Executor WASM
   */
  async start(
    logLevel: "trace" | "debug" | "info" | "error" = "info",
    rpcUrl: string = "https://testnet.ckb.dev/",
  ) {
    console.log("Starting SSRIExecutor WASM");
    this.executorWorker.postMessage({
      inputBuffer: this.inputBuffer,
      outputBuffer: this.outputBuffer,
      logLevel: logLevel,
      traceLogBuffer: this.traceLogBuffer,
      rpcUrl: rpcUrl,
    } as SSRIExecutorWorkerInitializeOptions);
    await new Promise<void>((res, rej) => {
      this.executorWorker.onmessage = () => res();
      // eslint-disable-next-line @typescript-eslint/prefer-promise-reject-errors
      this.executorWorker.onerror = (evt) => rej(evt);
    });
    void (async () => {
      while (!this.stopping) {
        const i32arr = new Int32Array(this.traceLogBuffer);
        const u8arr = new Uint8Array(this.traceLogBuffer);
        const resp = Atomics.waitAsync(i32arr, 0, 0);
        if (resp.async) {
          await resp.value;
        }
        if (i32arr[0] === 1) {
          const length = i32arr[1];
          const data = u8arr.slice(8, 8 + length);
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          const decoded = JSON.parse(new TextDecoder().decode(data));
          // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
          if (this.traceLogCallback !== null) this.traceLogCallback(decoded);
          i32arr[0] = 0;
          Atomics.notify(i32arr, 0);
        }
      }
      console.log("Exiting trace log fetcher..");
    })();
  }

  private invokeSSRIExecutorCommand(
    name: string,
    args?: unknown[],
  ): Promise<unknown> {
    // Why use lock here?
    // SSRI Executor WASM uses synchronous APIs, means if we send a call request through postMessage, onmessage will be called only when the command call resolved.
    // We use lock here to avoid multiple call to postMessage before onmessage fired, to avoid mixed result of different calls
    // Since SSRI Executor WASM is synchronous, we won't lose any performance by locking here
    return this.commandInvokeLock.runExclusive(async () => {
      this.executorWorker.postMessage({
        name,
        args: args || [],
      });
      return await new Promise((resolve, reject) => {
        const clean = () => {
          this.executorWorker.removeEventListener("message", resolveFn);
          this.executorWorker.removeEventListener("error", errorFn);
        };
        const resolveFn = (
          evt: MessageEvent<
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            { ok: true; data: any } | { ok: false; error: string }
          >,
        ) => {
          if (evt.data.ok === true) {
            resolve(evt.data.data);
          } else {
            // eslint-disable-next-line @typescript-eslint/prefer-promise-reject-errors
            reject(evt.data.error);
          }
          clean();
        };
        const errorFn = (evt: ErrorEvent) => {
          // eslint-disable-next-line @typescript-eslint/prefer-promise-reject-errors
          reject(evt);
          clean();
        };
        this.executorWorker.addEventListener("message", resolveFn);
        this.executorWorker.addEventListener("error", errorFn);
      });
    });
  }

  /**
   * Stop the SSRI Executor WASM instance.
   */
  async stop() {
    this.executorWorker.terminate();
    this.stopping = true;
  }

  async runScriptLevelCode(
    txHash: ccc.HexLike,
    index: ccc.NumLike,
    args: ccc.HexLike[],
    scriptDebug: boolean = false,
  ): Promise<SSRIExecutorResult> {
    return (await this.invokeSSRIExecutorCommand("run_script_level_code", [
      ccc.hexFrom(txHash),
      index,
      args.map((x) => ccc.hexFrom(x)),
      scriptDebug,
    ])) as SSRIExecutorResult;
  }

  async runScriptLevelScript(
    txHash: ccc.HexLike,
    index: ccc.NumLike,
    args: ccc.HexLike[],
    script: ccc.ScriptLike,
    scriptDebug: boolean = false,
  ): Promise<SSRIExecutorResult> {
    return (await this.invokeSSRIExecutorCommand("run_script_level_script", [
      ccc.hexFrom(txHash),
      index,
      args.map((x) => ccc.hexFrom(x)),
      cccA.JsonRpcTransformers.scriptFrom(script),
      scriptDebug,
    ])) as SSRIExecutorResult;
  }

  async runScriptLevelCell(
    txHash: ccc.HexLike,
    index: ccc.NumLike,
    args: ccc.HexLike[],
    cell: ccc.CellLike,
    scriptDebug: boolean = false,
  ): Promise<SSRIExecutorResult> {
    return (await this.invokeSSRIExecutorCommand("run_script_level_cell", [
      ccc.hexFrom(txHash),
      index,
      args.map((x) => ccc.hexFrom(x)),
      {
        cell_output: cccA.JsonRpcTransformers.cellOutputFrom(cell.cellOutput),
        hex_data: ccc.hexFrom(cell.outputData),
      },
      scriptDebug,
    ])) as SSRIExecutorResult;
  }

  async runScriptLevelTx(
    txHash: ccc.HexLike,
    index: ccc.NumLike,
    args: ccc.HexLike[],
    tx: ccc.TransactionLike,
    scriptDebug: boolean = false,
  ): Promise<SSRIExecutorResult> {
    return (await this.invokeSSRIExecutorCommand("run_script_level_tx", [
      ccc.hexFrom(txHash),
      index,
      args.map((x) => ccc.hexFrom(x)),
      {
        inner: cccA.JsonRpcTransformers.transactionFrom(tx),
        hash: ccc.Transaction.from(tx).hash(),
      },
      scriptDebug,
    ])) as SSRIExecutorResult;
  }

  /* Calls a method on the SSRI executor through SSRI Server.
   * @param codeOutPoint - The code OutPoint.
   * @param method - The SSRI method.
   * @param args - The arguments for the method.
   * @param context - The SSRI context for the method.
   * @param context.script - The script level parameters.
   * @param context.cell - The cell level parameters. Take precedence over script.
   * @param context.transaction - The transaction level parameters. Take precedence over cell.
   * @returns The result of the call.
   */
  async runScript(
    codeOutPoint: ccc.OutPointLike,
    method: string,
    args: ccc.HexLike[],
    context?: ContextCode | ContextScript | ContextCell | ContextTransaction,
  ): Promise<ExecutorResponse<ccc.Hex>> {
    const code = ccc.OutPoint.from(codeOutPoint);
    const [rpcMethod] = (() => {
      if (context?.tx) {
        const tx = ccc.Transaction.from(context.tx);
        return [
          "run_script_level_transaction",
          [
            {
              inner: cccA.JsonRpcTransformers.transactionFrom(tx),
              hash: tx.hash(),
            },
          ],
        ];
      }
      if (context?.cell) {
        return [
          "run_script_level_cell",
          [
            {
              cell_output: cccA.JsonRpcTransformers.cellOutputFrom(
                ccc.CellOutput.from(context.cell.cellOutput),
              ),
              hex_data: ccc.hexFrom(context.cell.outputData),
            },
          ],
        ];
      }
      if (context?.script) {
        return [
          "run_script_level_script",
          [cccA.JsonRpcTransformers.scriptFrom(context.script)],
        ];
      }
      return ["run_script_level_code", []];
    })();

    switch (rpcMethod) {
      case "run_script_level_transaction": {
        if (!context?.tx) {
          throw new ExecutorErrorUnknown("Transaction context is required");
        }
        const result = await this.runScriptLevelTx(
          code.txHash,
          Number(code.index),
          [getMethodPath(method), ...args.map(ccc.hexFrom)],
          context.tx,
        );
        return ExecutorResponse.new(result.content, result.cellDeps);
      }
      case "run_script_level_cell": {
        if (!context?.cell) {
          throw new ExecutorErrorUnknown("Cell context is required");
        }
        const result = await this.runScriptLevelCell(
          code.txHash,
          Number(code.index),
          [getMethodPath(method), ...args.map(ccc.hexFrom)],
          { ...context.cell, outPoint: { txHash: "0x0", index: "0x0" } },
        );
        return ExecutorResponse.new(result.content, result.cellDeps);
      }
      case "run_script_level_script": {
        if (!context?.script) {
          throw new ExecutorErrorUnknown("Script context is required");
        }
        const result = await this.runScriptLevelScript(
          code.txHash,
          Number(code.index),
          [getMethodPath(method), ...args.map(ccc.hexFrom)],
          context.script,
        );
        return ExecutorResponse.new(result.content, result.cellDeps);
      }
      case "run_script_level_code": {
        const result = await this.runScriptLevelCode(
          code.txHash,
          Number(code.index),
          [getMethodPath(method), ...args.map(ccc.hexFrom)],
        );
        return ExecutorResponse.new(result.content, result.cellDeps);
      }
      default:
        throw new ExecutorErrorUnknown(`Unsupported method: ${rpcMethod}`);
    }
  }
}
