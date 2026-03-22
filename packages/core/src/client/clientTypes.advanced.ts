import { Num, numFrom, NumLike } from "../num/index.js";

export const DEFAULT_MAX_FEE_RATE = numFrom(10000000);
export const DEFAULT_MIN_FEE_RATE = numFrom(1000);

export function clientSearchKeyRangeFrom([a, b]: [NumLike, NumLike]): [
  Num,
  Num,
] {
  return [numFrom(a), numFrom(b)];
}
