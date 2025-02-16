import { ccc } from "@ckb-ccc/core";
import { cccA } from "@ckb-ccc/core/advanced";
import { Mutex } from "async-mutex";
import ExecutorWorker from "./executor.worker.js";
import RpcWorker from "./rpc.worker.js";
import {
  BroadcastChannelMessagePacket,
  SSRIExecutorResult,
  SSRIExecutorWorkerInitializeOptions,
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

export class ExecutorWASM extends Executor {
  public readonly url: string;
  private executorWorker: Worker;
  private rpcWorker: Worker;
  private commandInvokeLock: Mutex;
  private stopping: boolean = false;
  public broadcastChannel: BroadcastChannel;
  public started = false;
  public maxIterations: number = 3;
  public iterationIntervalMs: number = 1000;
  public scriptDebug: boolean = false;
  public network: "testnet" | "mainnet" = "testnet";
  /**
   * Creates an instance of SSRI executor in WASM with Workers
   * @param {string} [url] - The external server URL.
   */
  constructor(
    url: string,
    scriptDebug: boolean = false,
    maxIterations: number = 10,
    iterationIntervalMs: number = 1000,
    network: "testnet" | "mainnet" = "testnet",
  ) {
    super();

    this.executorWorker = new ExecutorWorker();
    this.rpcWorker = new RpcWorker();
    this.commandInvokeLock = new Mutex();
    this.scriptDebug = scriptDebug;
    this.maxIterations = maxIterations;
    this.iterationIntervalMs = iterationIntervalMs;

    this.url = url;
    this.network = network;
    this.broadcastChannel = new BroadcastChannel("ssri");
  }

  async confirmStarted(): Promise<boolean> {
    if (!this.started) {
      await this.start("debug");
      this.started = true;
    }
    return this.started;
  }

  /**
   * Start the SSRI Executor WASM.
   * @param logLevel Log Level for the SSRI Executor WASM
   */
  async start(logLevel: "trace" | "debug" | "info" | "error" = "info") {
    const initializeMessagePacket: BroadcastChannelMessagePacket = {
      senderName: "ssriExecutor",
      targetName: "ssriWorkers",
      messageLabel: "initialize",
      dataTypeHint: "SSRIExecutorWorkerInitializeOptions",
      data: {
        logLevel: logLevel,
        channelName: "ssri",
        rpcUrl: this.url,
        network: this.network,
      } as SSRIExecutorWorkerInitializeOptions,
    };

    try {
      this.broadcastChannel.postMessage(initializeMessagePacket);
      this.started = true;
    } catch (error) {
      console.error("Failed to send initialize message:", error);
      throw error;
    }
  }

  private invokeSSRIExecutorCommand(
    name: string,
    args?: unknown[],
  ): Promise<unknown> {
    return this.commandInvokeLock.runExclusive(async () => {
      this.broadcastChannel.postMessage({
        senderName: "ssriExecutor",
        targetName: "ssriExecutorWorker",
        messageLabel: "execute",
        dataTypeHint: "SSRIExecutorFunctionCall",
        data: {
          name,
          args: args || [],
        },
      });
      return await new Promise((resolve, reject) => {
        const clean = () => {
          this.broadcastChannel.removeEventListener("message", resolveFn);
        };
        const resolveFn = (
          evt: MessageEvent<{
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            data: any;
            messageLabel: string;
            senderName: string;
            targetName: string;
          }>,
        ) => {
          if (evt.data.messageLabel === "executionResult") {
            const result: SSRIExecutorResult = {
              content: evt.data.data.content as ccc.Hex,
              cellDeps: (evt.data.data.cellDeps as cccA.JsonRpcOutPoint[]).map(
                cccA.JsonRpcTransformers.outPointTo,
              ),
            };
            resolve(result);
          } else {
            // eslint-disable-next-line @typescript-eslint/prefer-promise-reject-errors
            reject(evt.data.data);
          }
          clean();
        };
        this.broadcastChannel.addEventListener("message", resolveFn);
      });
    });
  }

  /**
   * Stop the SSRI Executor WASM instance.
   */
  async stop() {
    this.executorWorker.terminate();
    this.rpcWorker.terminate();
    this.stopping = true;
  }

  async runScriptLevelCode(
    txHash: ccc.HexLike,
    index: ccc.NumLike,
    args: ccc.HexLike[],
    scriptDebug: boolean = false,
    maxIterations: number = 10,
    iterationIntervalMs: number = 1000,
  ): Promise<SSRIExecutorResult> {
    let iterations = 0;

    while (iterations <= maxIterations) {
      try {
        await this.confirmStarted();
        return (await this.invokeSSRIExecutorCommand("run_script_level_code", [
          ccc.hexFrom(txHash),
          index,
          args.map((x) => ccc.hexFrom(x)),
          scriptDebug,
        ])) as SSRIExecutorResult;
      } catch (_error) {
        iterations++;

        if (iterations <= maxIterations) {
          // Wait with exponential backoff before retrying
          await new Promise((resolve) =>
            setTimeout(
              resolve,
              iterationIntervalMs * Math.pow(2, iterations - 1),
            ),
          );
        }
      }
    }

    throw new ExecutorErrorExecutionFailed(
      `Failed after ${maxIterations + 1} iterations.`,
    );
  }

  async runScriptLevelScript(
    txHash: ccc.HexLike,
    index: ccc.NumLike,
    args: ccc.HexLike[],
    script: ccc.ScriptLike,
    scriptDebug: boolean = false,
    maxIterations: number = 10,
    iterationIntervalMs: number = 1000,
  ): Promise<SSRIExecutorResult> {
    let iterations = 0;

    while (iterations <= maxIterations) {
      try {
        return (await this.invokeSSRIExecutorCommand(
          "run_script_level_script",
          [
            ccc.hexFrom(txHash),
            index,
            args.map((x) => ccc.hexFrom(x)),
            cccA.JsonRpcTransformers.scriptFrom(script),
            scriptDebug,
          ],
        )) as SSRIExecutorResult;
      } catch (_error) {
        iterations++;

        if (iterations <= maxIterations) {
          // Wait with exponential backoff before retrying
          await new Promise((resolve) =>
            setTimeout(
              resolve,
              iterationIntervalMs * Math.pow(2, iterations - 1),
            ),
          );
        }
      }
    }

    throw new ExecutorErrorExecutionFailed(
      `Failed after ${maxIterations + 1} iterations.`,
    );
  }

  async runScriptLevelCell(
    txHash: ccc.HexLike,
    index: ccc.NumLike,
    args: ccc.HexLike[],
    cell: ccc.CellLike,
    scriptDebug: boolean = false,
    maxIterations: number = 10,
    iterationIntervalMs: number = 1000,
  ): Promise<SSRIExecutorResult> {
    let iterations = 0;

    while (iterations <= maxIterations) {
      try {
        return (await this.invokeSSRIExecutorCommand("run_script_level_cell", [
          ccc.hexFrom(txHash),
          index,
          args.map((x) => ccc.hexFrom(x)),
          {
            cell_output: cccA.JsonRpcTransformers.cellOutputFrom(
              cell.cellOutput,
            ),
            hex_data: ccc.hexFrom(cell.outputData),
          },
          scriptDebug,
        ])) as SSRIExecutorResult;
      } catch (_error) {
        iterations++;

        if (iterations <= maxIterations) {
          // Wait with exponential backoff before retrying
          await new Promise((resolve) =>
            setTimeout(
              resolve,
              iterationIntervalMs * Math.pow(2, iterations - 1),
            ),
          );
        }
      }
    }

    throw new ExecutorErrorExecutionFailed(
      `Failed after ${maxIterations + 1} iterations.`,
    );
  }

  async runScriptLevelTx(
    txHash: ccc.HexLike,
    index: ccc.NumLike,
    args: ccc.HexLike[],
    tx: ccc.TransactionLike,
    scriptDebug: boolean = false,
    maxIterations: number = 10,
    iterationIntervalMs: number = 1000,
  ): Promise<SSRIExecutorResult> {
    let iterations = 0;

    while (iterations <= maxIterations) {
      try {
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
      } catch (_error) {
        iterations++;

        if (iterations <= maxIterations) {
          // Wait with exponential backoff before retrying
          await new Promise((resolve) =>
            setTimeout(
              resolve,
              iterationIntervalMs * Math.pow(2, iterations - 1),
            ),
          );
        }
      }
    }

    throw new ExecutorErrorExecutionFailed(
      `Failed after ${maxIterations + 1} iterations.`,
    );
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
    let result: SSRIExecutorResult;
    switch (rpcMethod) {
      case "run_script_level_transaction":
        {
          if (!context?.tx) {
            throw new ExecutorErrorUnknown("Transaction context is required");
          }
          result = await this.runScriptLevelTx(
            code.txHash,
            Number(code.index),
            [getMethodPath(method), ...args.map(ccc.hexFrom)],
            context.tx,
            this.scriptDebug,
            this.maxIterations,
            this.iterationIntervalMs,
          );
        }
        break;
      case "run_script_level_cell":
        {
          if (!context?.cell) {
            throw new ExecutorErrorUnknown("Cell context is required");
          }
          result = await this.runScriptLevelCell(
            code.txHash,
            Number(code.index),
            [getMethodPath(method), ...args.map(ccc.hexFrom)],
            { ...context.cell, outPoint: { txHash: "0x0", index: "0x0" } },
            this.scriptDebug,
            this.maxIterations,
            this.iterationIntervalMs,
          );
        }
        break;
      case "run_script_level_script":
        {
          if (!context?.script) {
            throw new ExecutorErrorUnknown("Script context is required");
          }
          result = await this.runScriptLevelScript(
            code.txHash,
            Number(code.index),
            [getMethodPath(method), ...args.map(ccc.hexFrom)],
            context.script,
            this.scriptDebug,
            this.maxIterations,
            this.iterationIntervalMs,
          );
        }
        break;
      case "run_script_level_code":
        {
          result = await this.runScriptLevelCode(
            code.txHash,
            Number(code.index),
            [getMethodPath(method), ...args.map(ccc.hexFrom)],
            this.scriptDebug,
            this.maxIterations,
            this.iterationIntervalMs,
          );
        }
        break;
      default:
        throw new ExecutorErrorUnknown(`Unsupported method: ${rpcMethod}`);
    }
    return ExecutorResponse.new(result.content, result.cellDeps);
  }
}
