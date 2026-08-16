import { ccc } from "@ckb-ccc/connector-react";
import { explorerLink } from "../explorer-link";
import type { ModuleRuntimeProps } from "../modules";

export function bytesFromAnyString(value: string): ccc.Bytes {
  try {
    return ccc.bytesFrom(value);
  } catch {
    return ccc.bytesFrom(value, "utf8");
  }
}

export function showTransaction(
  client: ccc.Client,
  show: ModuleRuntimeProps["show"],
  txHash: string,
  message: string,
  committed = false,
) {
  show({
    label: committed ? "COMMITTED" : "TRANSMITTED",
    tone: committed ? "success" : "pending",
    content: explorerLink(
      client,
      "transaction",
      txHash,
      <>
        <span>{message}</span>
        <code>{shortHash(txHash)}</code>
      </>,
    ),
  });
}

export function reportModuleError(
  cause: unknown,
  show: ModuleRuntimeProps["show"],
  log: ModuleRuntimeProps["log"],
  fallback = "Operation failed",
) {
  const message = cause instanceof Error ? cause.message : fallback;
  show({ label: "FAULT", tone: "error", content: <strong>{message}</strong> });
  log(message, "error");
}

export function splitLines(value: string) {
  return value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

export function tokenInfoToBytes(
  decimals: ccc.NumLike,
  symbol: string,
  name: string,
) {
  const symbolBytes = ccc.bytesFrom(symbol, "utf8");
  const nameBytes = ccc.bytesFrom(name || symbol, "utf8");
  return ccc.bytesConcat(
    ccc.numToBytes(decimals, 1),
    ccc.numToBytes(nameBytes.length, 1),
    nameBytes,
    ccc.numToBytes(symbolBytes.length, 1),
    symbolBytes,
  );
}

function shortHash(hash: string) {
  return `${hash.slice(0, 10)}…${hash.slice(-8)}`;
}
