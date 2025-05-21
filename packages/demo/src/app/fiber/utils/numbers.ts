import { ccc } from "@ckb-ccc/connector-react";

const CKB_UNIT = BigInt(100000000); // 1 CKB = 10^8 shannon

export const shannonToCKB = (shannon: string) => {
  if (!shannon) return "0";
  // 将浮点数转换为整数（shannon）
  const shannonValue = Math.floor(parseFloat(shannon) * 100000000);
  const shannonBigInt = BigInt(shannonValue);
  return ccc.fixedPointToString(shannonBigInt / CKB_UNIT);
};