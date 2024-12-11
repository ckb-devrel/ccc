import { ccc } from "@ckb-ccc/core";

export function getMethodPath(method: string): ccc.Hex {
  return ccc.hashCkb(ccc.bytesFrom(method, "utf8")).slice(0, 18) as ccc.Hex;
}
