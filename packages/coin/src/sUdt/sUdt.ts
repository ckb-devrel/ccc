import { ccc } from "@ckb-ccc/core";
import { Coin } from "../coin/coin.js";

/**
 * A {@link Coin} subclass for the sUDT (Simple UDT) standard.
 *
 * The sUDT type script args are the blake2b hash of the owner lock script.
 * Minting authority is proven by consuming any cell locked with that lock
 * as a transaction input — no extra witness data is required.
 *
 * @public
 * @category Blockchain
 * @category Token
 * @see {@link https://github.com/nervosnetwork/rfcs/blob/master/rfcs/0025-simple-udt/0025-simple-udt.md sUDT RFC}
 */
export class SUdt extends Coin {
  /**
   * Creates an `SUdt` instance.
   *
   * @param options.ownerLockHash - Hash of the owner lock script. Becomes the
   *   type script `args` and defines which lock proves minting authority.
   * @param options.codeHash - sUDT contract code hash.
   * @param options.hashType - sUDT contract hash type.
   * @param options.cellDeps - Cell deps for the sUDT contract.
   * @param options.signer - Signer used for input sourcing and transaction
   *   completion. Required by `burn` and other `complete*` methods.
   * @param options.client - Client for network requests. Used when no signer
   *   is provided. At least one of `signer` or `client` must be supplied.
   *
   * @example
   * ```typescript
   * const sUdt = new SUdt({
   *   ownerLockHash: ownerLock.hash(),
   *   codeHash: "0x...",
   *   hashType: "type",
   *   cellDeps: [{ outPoint: codeOutPoint, depType: "code" }],
   *   signer,
   * });
   * ```
   */
  constructor(
    options: {
      script:
        | {
            codeHash?: ccc.BytesLike | null;
            hashType?: ccc.HashTypeLike | null;
            args: ccc.BytesLike;
          }
        | Promise<{
            codeHash?: ccc.BytesLike | null;
            hashType?: ccc.HashTypeLike | null;
            args: ccc.BytesLike;
          }>;
      filter?:
        | ccc.ClientIndexerSearchKeyFilterLike
        | Promise<ccc.ClientIndexerSearchKeyFilterLike>
        | null;
      cellDeps?: ccc.CellDepLike[] | Promise<ccc.CellDepLike[]> | null;
      knownScript?: ccc.KnownScript | Promise<ccc.KnownScript> | null;
    } & (
      | {
          client: ccc.Client;
          signer?: null;
        }
      | {
          client?: ccc.Client | null;
          signer: ccc.Signer;
        }
    ),
  ) {
    const resolved = Promise.all([
      Promise.resolve(options.script),
      Promise.resolve(options.cellDeps),
    ]).then(
      async ([script, cellDeps]): Promise<
        [ccc.ScriptLike, ccc.CellDepLike[]]
      > => {
        if (
          script.codeHash != null &&
          script.hashType != null &&
          cellDeps != null
        ) {
          return [script as ccc.ScriptLike, cellDeps];
        }

        const scriptInfo = await this.client.getKnownScript(
          options.knownScript
            ? await options.knownScript
            : ccc.KnownScript.SUdt,
        );
        return [
          {
            codeHash: script.codeHash ?? scriptInfo.codeHash,
            hashType: script.hashType ?? scriptInfo.hashType,
            args: script.args,
          },
          await this.client.getCellDeps(scriptInfo.cellDeps),
        ];
      },
    );

    super({
      ...options,
      script: resolved.then(([script]) => script),
      cellDeps: resolved.then(([_, cellDeps]) => cellDeps),
    });
  }
}
