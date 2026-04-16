// ── fiber-js snake_case wire types (subset used by this demo) ─────────────────
// Defined locally so the page does not depend on @nervosnetwork/fiber-js
// TypeScript declarations, which live in a separate workspace package.

export type FjNodeInfo = {
  version: string;
  pubkey: string;
  addresses: string[];
  channel_count: string; // 0x-prefixed hex
  pending_channel_count: string;
  peers_count: string;
};

export type FjPeer = { pubkey: string; address: string };

export type FjChannel = {
  channel_id: string;
  pubkey: string;
  state: { state_name: string; state_flags: string };
  local_balance: string; // shannons, hex
  remote_balance: string;
  is_public: boolean;
};

export type FjInvoice = {
  invoice_address: string;
  invoice: { currency: string; data: { payment_hash: string } };
};

export type FjGetInvoice = FjInvoice & { status: string };

export type FjPayment = {
  payment_hash: string;
  status: string;
  failed_error?: string;
};

export type FjOpenChannel = {
  temporary_channel_id: string;
};

// ── Minimal Fiber instance interface (satisfies fiber-js Fiber class) ─────────

export type FiberInstance = {
  invokeCommand(name: string, args?: unknown[]): Promise<unknown>;
  stop(): Promise<void>;
};

// ── UI types ──────────────────────────────────────────────────────────────────

export type LogLevel = "info" | "warn" | "error" | "success";

export type LogEntry = {
  id: number;
  level: LogLevel;
  time: string;
  msg: string;
};

export type Tab = "peers" | "channels" | "invoices" | "payments";
