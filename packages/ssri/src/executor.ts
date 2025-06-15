import { ccc } from "@ckb-ccc/core";
import { cccA } from "@ckb-ccc/core/advanced";
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

  async mapAsync<U>(fn: (res: T) => Promise<U>): Promise<ExecutorResponse<U>> {
    try {
      return new ExecutorResponse(await fn(this.res), this.cellDeps);
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
