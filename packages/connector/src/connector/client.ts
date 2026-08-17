import { ccc } from "@ckb-ccc/ccc";
import { DEFAULT_MAX_FEE_RATE } from "@ckb-ccc/ccc/advancedBarrel";

// @ts-expect-error TS2655: Abstract Client members are forwarded by the Proxy at runtime.
export class ClientWithFeeRate extends ccc.Proxy.Base(ccc.Client) {
  static readonly [ccc.Proxy.localKeys] = ["feeRate"];

  public feeRate?: ccc.Num;

  async getFeeRate(
    blockRange?: ccc.NumLike,
    options?: { maxFeeRate?: ccc.NumLike },
  ): Promise<ccc.Num> {
    if (this.feeRate == null) {
      return this[ccc.Proxy.inner].getFeeRate(blockRange, options);
    }

    const maxFeeRate = ccc.numFrom(options?.maxFeeRate ?? DEFAULT_MAX_FEE_RATE);
    if (maxFeeRate === ccc.Zero) {
      return this.feeRate;
    }

    return ccc.numMin(this.feeRate, maxFeeRate);
  }
}
