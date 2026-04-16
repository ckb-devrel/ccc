import { ccc } from "@ckb-ccc/connector-react";

// ── localStorage keys ─────────────────────────────────────────────────────────

export const LS_MANUAL_CONFIG = "fiber-demo-manual-config";

/**
 * Fixed text every wallet signs once to derive a deterministic 32-byte
 * secp256k1 key pair for the in-browser fiber node.
 */
export const SIGN_MESSAGE = "Fiber Demo Node Key v1";

/** localStorage key for the derived fiber key, scoped to a wallet address. */
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

/** Converts a shannon balance (hex) to a CKB string with 4 decimal places. */
export function hexToCkb(hex: string): string {
  return (Number(ccc.numFrom(hex)) / 1e8).toFixed(4);
}

/** Masks the middle of a hex key for safe display. */
export function maskKey(key: string): string {
  return `${key.slice(0, 10)}···${key.slice(-6)}`;
}
