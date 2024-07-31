import { ScriptLike } from "../ckb/index.js";
import { HexLike } from "../hex/index.js";
import { Num, numFrom, NumLike } from "../num/index.js";

export function clientSearchKeyRangeFrom([a, b]: [NumLike, NumLike]): [
  Num,
  Num,
] {
  return [numFrom(a), numFrom(b)];
}

export type ClientCollectableSearchKeyFilterLike = {
  script?: ScriptLike | null;
  scriptLenRange?: [NumLike, NumLike] | null;
  outputData?: HexLike | null;
  outputDataSearchMode?: "prefix" | "exact" | "partial" | null;
  outputDataLenRange?: [NumLike, NumLike] | null;
  outputCapacityRange?: [NumLike, NumLike] | null;
};
export type ClientCollectableSearchKeyLike = {
  script: ScriptLike;
  scriptType: "lock" | "type";
  scriptSearchMode: "prefix" | "exact" | "partial";
  filter?: ClientCollectableSearchKeyFilterLike | null;
  withData?: boolean | null;
};
