import { ccc } from "@ckb-ccc/connector-react";
import Link from "next/link";

export function tokenInfoToBytes(
  decimals: ccc.NumLike,
  symbol: string,
  name: string
) {
  const symbolBytes = ccc.bytesFrom(symbol, "utf8");
  const nameBytes = ccc.bytesFrom(name === "" ? symbol : name, "utf8");
  return ccc.bytesConcat(
    ccc.numToBytes(decimals, 1),
    ccc.numToBytes(nameBytes.length, 1),
    nameBytes,
    ccc.numToBytes(symbolBytes.length, 1),
    symbolBytes
  );
}

export function bytesFromAnyString(str: string): ccc.Bytes {
  try {
    return ccc.bytesFrom(str);
  } catch (e) {}

  return ccc.bytesFrom(str, "utf8");
}

export function formatString(
  str: string | undefined,
  l = 9,
  r = 6
): string | undefined {
  if (str && str.length > l + r + 3) {
    return `${str.slice(0, l)}...${str.slice(-r)}`;
  }
  return str;
}

export function useGetExplorerLink() {
  const { client } = ccc.useCcc();

  const prefix =
    client.addressPrefix === "ckb"
      ? "https://explorer.nervos.org"
      : "https://pudge.explorer.nervos.org";

  return {
    index: prefix,
    explorerAddress: (addr: string, display?: string) => {
      return (
        <Link
          className="underline"
          href={`${prefix}/address/${addr}`}
          target="_blank"
        >
          {display ?? addr}
        </Link>
      );
    },
    explorerTransaction: (txHash: string, display?: string) => {
      return (
        <Link
          className="underline"
          href={`${prefix}/transaction/${txHash}`}
          target="_blank"
        >
          {display ?? txHash}
        </Link>
      );
    },
  };
}

export function getScriptColor(script: ccc.ScriptLike): string {
  const hash = ccc.Script.from(script).hash();

  return `hsl(${(ccc.numFrom(hash) % ccc.numFrom(360)).toString()} 65% 45%)`;
}
