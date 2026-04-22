import { ccc } from "@ckb-ccc/connector-react";

// ── localStorage keys ─────────────────────────────────────────────────────────

export const LS_MANUAL_CONFIG = "fiber-demo-manual-config";

export const SIGN_MESSAGE = "Fiber Demo Node Key v1";

export function lsNodeKeyFor(walletAddr: string): string {
  return `fiber-demo-nodekey-${walletAddr}`;
}

export function readLs(key: string, fallback = ""): string {
  if (typeof window === "undefined") return fallback;
  return localStorage.getItem(key) ?? fallback;
}

export function writeLs(key: string, value: string): void {
  if (typeof window !== "undefined") localStorage.setItem(key, value);
}

// ── Display helpers ───────────────────────────────────────────────────────────

export function hexToCkb(hex: string): string {
  return (Number(ccc.numFrom(hex)) / 1e8).toFixed(4);
}

export function maskKey(key: string): string {
  return `${key.slice(0, 10)}···${key.slice(-6)}`;
}
