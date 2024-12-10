import { CellDepLike, CellOutputLike, OutPointLike } from "../ckb/index.js";
import { HexLike } from "../hex/index.js";

export interface LumosTransactionSkeletonType {
  cellDeps: {
    toArray(): CellDepLike[];
  };
  headerDeps: {
    toArray(): HexLike[];
  };
  inputs: {
    toArray(): {
      outPoint?: OutPointLike;
      cellOutput: CellOutputLike;
      data: HexLike;
    }[];
  };
  inputSinces: {
    get(i: number, defaultVal: string): HexLike;
  };
  outputs: {
    toArray(): { cellOutput: CellOutputLike; data: HexLike }[];
  };
  witnesses: {
    toArray(): HexLike[];
  };
}
