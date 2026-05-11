// ── fiber-js snake_case wire types (subset used by this demo) ─────────────────
// Defined locally to avoid depending on @nervosnetwork/fiber-js TS declarations.

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
  channel_id: string;
};

// ── CKB JSON-RPC transaction format (used by external-funding flow) ───────────

export type CkbRpcScript = {
  code_hash: string;
  hash_type: string;
  args: string;
};

export type CkbRpcTransaction = {
  version: string;
  cell_deps: Array<{
    dep_type: string;
    out_point: { tx_hash: string; index: string };
  }>;
  header_deps: string[];
  inputs: Array<{
    previous_output: { tx_hash: string; index: string };
    since: string;
  }>;
  outputs: Array<{ capacity: string; lock: CkbRpcScript; type?: CkbRpcScript }>;
  outputs_data: string[];
  witnesses: string[];
};

// ── Minimal Fiber instance interface (satisfies fiber-js Fiber class) ─────────

export type FiberInstance = {
  invokeCommand(name: string, args?: unknown[]): Promise<unknown>;
  stop(): Promise<void>;
  openChannelWithExternalFunding(params: {
    pubkey: string;
    funding_amount: string;
    public?: boolean;
    shutdown_script: CkbRpcScript;
    funding_lock_script: CkbRpcScript;
    funding_lock_script_cell_deps?: Array<{
      dep_type: string;
      out_point: { tx_hash: string; index: string };
    }>;
  }): Promise<{ channel_id: string; unsigned_funding_tx: CkbRpcTransaction }>;
  submitSignedFundingTx(params: {
    channel_id: string;
    signed_funding_tx: CkbRpcTransaction;
  }): Promise<{ channel_id: string; funding_tx_hash: string }>;
};

// ── UI types ──────────────────────────────────────────────────────────────────

export type LogLevel = "info" | "warn" | "error" | "success";

export type LogEntry = {
  id: number;
  level: LogLevel;
  time: string;
  msg: string;
};

export type FjGraphNode = {
  node_name: string;
  pubkey: string;
  auto_accept_min_ckb_funding_amount: string; // shannons, hex
  timestamp: string; // hex, milliseconds since epoch
};

export type FjGraphChannel = {
  channel_outpoint: string;
  node1: string; // pubkey
  node2: string; // pubkey
  created_timestamp: string; // hex, milliseconds since epoch
  capacity: string; // shannons, hex
};

export type Tab = "peers" | "channels" | "invoices" | "payments" | "graph";
