import { ccc } from "@ckb-ccc/core";

import { RgbppUdtToken } from "./types.js";

export const encodeRgbppUdtToken = (token: RgbppUdtToken): string => {
  const name = ccc.bytesFrom(token.name, "utf8");
  const symbol = ccc.bytesFrom(token.symbol, "utf8");
  return ccc.hexFrom(
    ccc.bytesConcat(
      ccc.numToBytes(token.decimal, 1),
      ccc.numToBytes(name.length, 1),
      name,
      ccc.numToBytes(symbol.length, 1),
      symbol,
    ),
  );
};
