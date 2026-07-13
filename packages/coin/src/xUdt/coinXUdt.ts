import { ccc } from "@ckb-ccc/core";
import { Coin, CoinOptionsCommon, CoinOptionsScript } from "../coin/coin.js";
import { CoinXUdtArgs, CoinXUdtArgsLike } from "./args.js";

/**
 * Script configurations for {@link CoinXUdt}.
 *
 * `CoinXUdt` accepts either existing xUDT type args through `script.args`, or
 * structured args through `xUdtArgs`. When both are provided, `xUdtArgs` is
 * used to build the final `script.args`.
 *
 * A complete `script` with `codeHash` and `hashType` takes priority over
 * `knownScript`. If the script is incomplete, `knownScript` is used as
 * shorthand and defaults to {@link ccc.KnownScript.XUdt}.
 *
 * @public
 */
export type CoinXUdtOptionsScript = Omit<CoinOptionsScript, "script"> & {
  /**
   * Optional xUDT type script fields.
   *
   * Provide `args` to reuse existing xUDT args. Provide `codeHash` and
   * `hashType` to use an explicit deployment instead of the known xUDT script
   * shorthand.
   */
  script?: {
    codeHash?: ccc.HexLike | null;
    hashType?: ccc.HashTypeLike | null;
    args?: ccc.BytesLike | null;
  } | null;

  /**
   * Structured xUDT args.
   *
   * When provided, this value is encoded with {@link CoinXUdtArgs} and
   * overrides `script.args`.
   */
  xUdtArgs?: CoinXUdtArgsLike | null;
};

/**
 * Options for creating a {@link CoinXUdt} instance.
 *
 * Requires either `xUdtArgs` or `script.args` so the xUDT token identity can be
 * determined. A `client` is required for network access, following
 * {@link Coin}'s construction rules.
 *
 * @public
 */
export type CoinXUdtOptions = CoinOptionsCommon & CoinXUdtOptionsScript;

/**
 * An extensible UDT (xUDT) Coin implementation.
 *
 * `CoinXUdt` is a small specialization of {@link Coin} that understands the
 * xUDT type args layout from [RFC 52](https://github.com/nervosnetwork/rfcs/blob/master/rfcs/0052-extensible-udt/0052-extensible-udt.md).
 * It keeps the generic balance, transfer, and transaction completion
 * behavior from `Coin`, while exposing the parsed xUDT args via {@link CoinXUdt.args}.
 *
 * @example
 * ```ts
 * const xUdt = await CoinXUdt.new({
 *   xUdtArgs: {
 *     ownerScriptHash: ownerLock.hash(),
 *     ownerModeOutputType: true,
 *   },
 *   client,
 * });
 * ```
 *
 * @public
 */
export class CoinXUdt extends Coin {
  /**
   * Parsed and normalized xUDT type args.
   *
   * If `xUdtArgs` was provided, this is the normalized form of that value. If
   * only `script.args` was provided, this is parsed from the existing args.
   *
   * @public
   */
  public readonly args: Readonly<CoinXUdtArgs>;

  /** @internal */
  protected constructor(
    options: Awaited<ReturnType<typeof CoinXUdt.resolveOptions>>,
  ) {
    super(options);
    this.args = options.args;
  }

  /**
   * Creates an xUDT coin helper.
   *
   * `xUdtArgs` takes priority over `script.args` for the final type script args.
   * A complete `script` takes priority over `knownScript`; otherwise the known
   * script shorthand defaults to {@link ccc.KnownScript.XUdt}.
   *
   * @throws if neither `xUdtArgs` nor `script.args` is provided.
   * @throws if the selected args cannot be parsed as xUDT args.
   * @public
   */
  static override async new(options: CoinXUdtOptions): Promise<CoinXUdt> {
    return new CoinXUdt(await CoinXUdt.resolveOptions(options));
  }

  /** Resolves xUDT args and asynchronous Coin dependencies. @internal */
  protected static override async resolveOptions(options: CoinXUdtOptions) {
    let args;
    if (options.xUdtArgs != null) {
      args = CoinXUdtArgs.from(options.xUdtArgs);
    } else if (options.script?.args != null) {
      args = CoinXUdtArgs.fromBytes(options.script.args);
    } else {
      throw new Error(
        "Either xUdtArgs or script.args must be provided for CoinXUdt",
      );
    }

    return {
      ...(await super.resolveOptions({
        ...options,
        script: {
          ...(options.script ?? {}),
          args: args.toBytes(),
        },
        knownScript: options.knownScript ?? ccc.KnownScript.XUdt,
      })),
      args,
    };
  }
}
