import { ccc } from "@ckb-ccc/core";
export const deadLock = ccc.Script.from({
  codeHash:
    "0x0000000000000000000000000000000000000000000000000000000000000000",
  hashType: "data",
  args: "0x",
});

export const DEFAULT_DUST_LIMIT = 546;

export const DEFAULT_FEE_RATE = 1;
