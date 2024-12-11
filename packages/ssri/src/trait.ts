import { ccc } from "@ckb-ccc/core";
import { Executor, ExecutorResponse } from "./executor.js";
import { getMethodPath } from "./utils.js";

/**
 * Abstract class representing an SSRI trait. Should be used as the base of all SSRI traits.
 */
export abstract class Trait {
  public readonly code: ccc.OutPoint;
  public readonly executor?: Executor;

  /**
   * Creates an instance of SSRI trait.
   * @param code - The cell dependency.
   * @param executor - The SSRI executor instance.
   */
  constructor(code: ccc.OutPointLike, executor?: Executor | null) {
    this.code = ccc.OutPoint.from(code);
    this.executor = executor ?? undefined;
  }

  assertExecutor() {
    if (!this.executor) {
      throw new Error("SSRI executor is not set");
    }

    return this.executor;
  }

  /**
   * Retrieves a list of methods.
   * @param offset - The offset for the methods.
   * @param limit - The limit for the methods.
   * @returns {Promise<Bytes[]>} A promise that resolves to a list of methods.
   */
  async getMethods(
    offset: ccc.NumLike = 0,
    limit: ccc.NumLike = 0,
  ): Promise<ExecutorResponse<ccc.Hex[]>> {
    const res = await this.assertExecutor().runScript(
      this.code,
      "SSRI.get_methods",
      [ccc.numToBytes(offset ?? 0, 8), ccc.numToBytes(limit ?? 0, 8)],
    );

    return res.map((res) => ccc.mol.Byte8Vec.decode(res));
  }

  /**
   * Checks if the specified methods exist.
   * @param methodNames - The methods to check.
   * @returns A promise that resolves to an array of booleans indicating if methods exist.
   */
  async hasMethods(
    methodNames: string[],
    extraMethodPaths?: ccc.HexLike[],
  ): Promise<ExecutorResponse<boolean[]>> {
    const methodPaths = ccc.mol.Byte8Vec.encode(
      methodNames
        .map(getMethodPath)
        .concat(extraMethodPaths?.map(ccc.hexFrom) ?? []),
    );
    const res = await this.assertExecutor().runScript(
      this.code,
      "SSRI.has_methods",
      [methodPaths],
    );
    return res.map((res) => ccc.mol.BoolVec.decode(res));
  }

  /**
   * Retrieves the version of the trait.
   * @returns A promise that resolves to the version number.
   */
  async version(): Promise<ExecutorResponse<ccc.Num>> {
    const res = await this.assertExecutor().runScript(
      this.code,
      "SSRI.version",
      [],
    );
    return res.map((res) => ccc.numFrom(res));
  }
}
