import { ccc } from "@ckb-ccc/connector-react";

/** Normalize Type ID args (strip 0x, trim). */
export function normalizeTypeIdArgs(args: string): string {
  const s = (args || "").trim();
  return s.startsWith("0x") ? s.slice(2) : s;
}

/** Create an unspendable lock script for immutable cells. */
export function createImmutableLock(): ccc.Script {
  return ccc.Script.from({
    codeHash: `0x${"00".repeat(32)}`,
    hashType: "data",
    args: "0x",
  });
}
