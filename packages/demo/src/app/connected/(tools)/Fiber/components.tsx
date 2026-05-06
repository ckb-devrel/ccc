import { Button } from "@/src/components/Button";
import { TextInput } from "@/src/components/Input";
import { ccc } from "@ckb-ccc/connector-react";
import { Copy, GitBranch, Network, Send, Terminal, Users } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { hexToCkb } from "./config";
import type {
  FjChannel,
  FjGetInvoice,
  FjGraphNode,
  FjInvoice,
  FjPeer,
  LogEntry,
  LogLevel,
  Tab,
} from "./types";

// ── Layout primitives ─────────────────────────────────────────────────────────

export function Card({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`overflow-hidden rounded-xl bg-white/75 shadow-sm ${className ?? ""}`}
    >
      {children}
    </div>
  );
}

export function InfoCard({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="rounded-lg bg-gray-50 px-3 py-2">
      <p className="text-xs text-gray-400">{label}</p>
      <p
        className={`mt-0.5 truncate text-sm font-medium text-gray-700 ${mono ? "font-mono" : ""}`}
      >
        {value}
      </p>
    </div>
  );
}

// ── Log panel ─────────────────────────────────────────────────────────────────

const LOG_TEXT: Record<LogLevel, string> = {
  info: "text-sky-400",
  warn: "text-amber-400",
  error: "text-rose-400",
  success: "text-emerald-400",
};

const LOG_LABEL: Record<LogLevel, string> = {
  info: "INFO",
  warn: "WARN",
  error: "ERR!",
  success: "OK  ",
};

const LOG_LABEL_COLOR: Record<LogLevel, string> = {
  info: "text-sky-500",
  warn: "text-amber-500",
  error: "text-rose-500",
  success: "text-emerald-500",
};

const FILTERS: { key: LogLevel | "all"; label: string }[] = [
  { key: "all", label: "All" },
  { key: "info", label: "Info" },
  { key: "warn", label: "Warn" },
  { key: "error", label: "Error" },
  { key: "success", label: "OK" },
];

export function LogPanel({
  logs,
  onClear,
}: {
  logs: LogEntry[];
  onClear: () => void;
}) {
  const [filter, setFilter] = useState<LogLevel | "all">("all");
  const scrollRef = useRef<HTMLDivElement>(null);
  const autoScrollRef = useRef(true);

  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) {
      return;
    }
    autoScrollRef.current =
      el.scrollHeight - el.scrollTop - el.clientHeight < 32;
  }, []);

  useEffect(() => {
    if (autoScrollRef.current && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs]);

  const filtered =
    filter === "all" ? logs : logs.filter((e) => e.level === filter);

  const counts = (["info", "warn", "error", "success"] as LogLevel[]).reduce(
    (acc, lvl) => {
      acc[lvl] = logs.filter((e) => e.level === lvl).length;
      return acc;
    },
    {} as Record<LogLevel, number>,
  );

  return (
    <div className="overflow-hidden rounded-xl shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between bg-[#161b22] px-4 py-2">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1.5 text-sm font-semibold text-gray-300">
            <Terminal size={13} />
            Node Logs
          </span>
          <span className="text-xs text-gray-600">{logs.length} lines</span>
          <span className="rounded bg-amber-900/40 px-2 py-0.5 text-xs text-amber-400">
            Fiber WASM logs → DevTools (F12) Console
          </span>
        </div>
        <div className="flex items-center gap-2">
          {FILTERS.map(({ key, label }) => {
            const count = key === "all" ? logs.length : counts[key];
            const active = filter === key;
            return (
              <button
                key={key}
                onClick={() => setFilter(key)}
                className={`rounded px-2 py-0.5 text-xs font-medium transition-colors ${
                  active
                    ? "bg-gray-600 text-gray-100"
                    : "text-gray-500 hover:text-gray-300"
                }`}
              >
                {label}
                {count > 0 && (
                  <span className="ml-1 text-gray-500">{count}</span>
                )}
              </button>
            );
          })}
          <div className="mx-1 h-3 w-px bg-gray-700" />
          <button
            className="text-xs text-gray-600 transition-colors hover:text-gray-400"
            onClick={onClear}
          >
            Clear
          </button>
        </div>
      </div>

      {/* Log body */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="h-96 overflow-y-auto bg-[#0d1117] p-3 font-mono text-xs"
      >
        {filtered.length === 0 ? (
          <p className="pt-4 text-center text-gray-700">
            {filter === "all" ? "No logs yet." : `No ${filter} entries.`}
          </p>
        ) : (
          filtered.map((e) => (
            <div key={e.id} className="flex gap-2 leading-5">
              <span className="shrink-0 text-gray-700">{e.time}</span>
              <span
                className={`w-8 shrink-0 font-bold ${LOG_LABEL_COLOR[e.level]}`}
              >
                {LOG_LABEL[e.level]}
              </span>
              <span className={`break-all ${LOG_TEXT[e.level]}`}>{e.msg}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// ── Tab bar ───────────────────────────────────────────────────────────────────

const TABS: { key: Tab; label: string }[] = [
  { key: "peers", label: "Peers" },
  { key: "channels", label: "Channels" },
  { key: "invoices", label: "Invoices" },
  { key: "payments", label: "Payments" },
  { key: "graph", label: "Graph" },
];

export function TabBar({
  active,
  onChange,
}: {
  active: Tab;
  onChange: (t: Tab) => void;
}) {
  return (
    <div className="flex border-b border-gray-100">
      {TABS.map(({ key, label }) => (
        <button
          key={key}
          onClick={() => onChange(key)}
          className={`flex-1 py-3 text-sm font-medium transition-colors ${
            active === key
              ? "border-b-2 border-neutral-700 text-neutral-700"
              : "text-gray-400 hover:text-gray-600"
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

// ── Peers tab ─────────────────────────────────────────────────────────────────

export function PeersTab({
  peers,
  onConnect,
  onDisconnect,
}: {
  peers: FjPeer[];
  onConnect: (addr: string) => Promise<void>;
  onDisconnect: (peerId: string) => Promise<void>;
}) {
  const [addr, setAddr] = useState("");
  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <div className="flex-1">
          <TextInput
            label="Peer multiaddr"
            state={[addr, setAddr]}
            placeholder="/ip4/127.0.0.1/tcp/8228/p2p/Qm..."
          />
        </div>
        <div className="flex items-end pb-4">
          <Button
            variant="primary"
            className="text-sm"
            disabled={!addr}
            onClick={() => onConnect(addr).then(() => setAddr(""))}
          >
            Connect
          </Button>
        </div>
      </div>
      <p className="flex items-center gap-1 text-xs font-medium text-gray-500">
        <Users size={13} /> Connected peers ({peers.length})
      </p>
      {peers.length === 0 ? (
        <p className="text-sm text-gray-300">No peers connected.</p>
      ) : (
        peers.map((p) => (
          <div
            key={p.pubkey}
            className="flex items-start justify-between gap-3 rounded-lg border border-gray-100 bg-gray-50 p-3"
          >
            <div className="min-w-0 flex-1">
              <p className="truncate font-mono text-xs font-medium text-gray-700">
                {p.pubkey}
              </p>
              <p className="mt-0.5 truncate text-xs text-gray-400">
                {p.address}
              </p>
            </div>
            <Button
              variant="danger"
              className="shrink-0 text-xs"
              onClick={() => onDisconnect(p.pubkey)}
            >
              Disconnect
            </Button>
          </div>
        ))
      )}
    </div>
  );
}

// ── Channels tab ──────────────────────────────────────────────────────────────

export function ChannelsTab({
  channels,
  onOpen,
  onClose,
}: {
  channels: FjChannel[];
  onOpen: (peerId: string, amount: string, isPublic: boolean) => Promise<void>;
  onClose: (channelId: string) => Promise<void>;
}) {
  const [peerId, setPeerId] = useState("");
  const [amount, setAmount] = useState("");
  const [isPublic, setIsPublic] = useState(true);

  return (
    <div className="space-y-4">
      {/* Open channel form */}
      <div className="rounded-lg border border-gray-100 bg-gray-50 p-3">
        <p className="mb-2 text-xs font-medium text-gray-600">Open Channel</p>
        <TextInput
          label="Peer Pubkey (hex, no 0x prefix)"
          state={[peerId, setPeerId]}
          placeholder="0260..."
        />
        <TextInput
          label="Funding Amount (CKB)"
          state={[amount, setAmount]}
          placeholder="62"
        />
        <div className="flex items-center justify-between px-4 pb-2">
          <label className="flex cursor-pointer items-center gap-2 text-sm text-gray-600">
            <input
              type="checkbox"
              checked={isPublic}
              onChange={(e) => setIsPublic(e.currentTarget.checked)}
              className="h-4 w-4 rounded border-gray-300"
            />
            Public channel
          </label>
          <Button
            variant="primary"
            className="text-sm"
            disabled={!peerId || !amount}
            onClick={() =>
              onOpen(peerId, amount, isPublic).then(() => {
                setPeerId("");
                setAmount("");
              })
            }
          >
            Open
          </Button>
        </div>
      </div>

      {/* Channel list */}
      <p className="flex items-center gap-1 text-xs font-medium text-gray-500">
        <GitBranch size={13} /> Channels ({channels.length})
      </p>
      {channels.length === 0 ? (
        <p className="text-sm text-gray-300">No channels.</p>
      ) : (
        channels.map((ch) => (
          <div
            key={ch.channel_id}
            className="rounded-lg border border-gray-100 bg-gray-50 p-3"
          >
            <div className="flex items-center justify-between gap-2">
              <p className="min-w-0 truncate font-mono text-xs font-medium text-gray-700">
                {ch.channel_id}
              </p>
              <div className="flex shrink-0 items-center gap-2">
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                    ch.state.state_name === "CHANNEL_READY"
                      ? "bg-green-100 text-green-700"
                      : "bg-yellow-100 text-yellow-700"
                  }`}
                >
                  {ch.state.state_name}
                </span>
                <Button
                  variant="danger"
                  className="text-xs"
                  onClick={() => onClose(ch.channel_id)}
                >
                  Close
                </Button>
              </div>
            </div>
            <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-gray-500">
              <span>Local: {hexToCkb(ch.local_balance)} CKB</span>
              <span>Remote: {hexToCkb(ch.remote_balance)} CKB</span>
              <span className="col-span-2 mt-1 truncate text-gray-400">
                Peer: {ch.pubkey}
              </span>
            </div>
          </div>
        ))
      )}
    </div>
  );
}

// ── Invoices tab ──────────────────────────────────────────────────────────────

const INVOICE_STATUS_COLOR: Record<string, string> = {
  Paid: "bg-green-100 text-green-700",
  Open: "bg-blue-100 text-blue-700",
};

export function InvoicesTab({
  onNew,
  onCheck,
}: {
  onNew: (amount: string, desc: string) => Promise<FjInvoice>;
  onCheck: (paymentHash: string) => Promise<FjGetInvoice>;
}) {
  const [amount, setAmount] = useState("");
  const [desc, setDesc] = useState("");
  const [invoiceAddr, setInvoiceAddr] = useState("");
  const [hash, setHash] = useState("");
  const [status, setStatus] = useState("");

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-gray-100 bg-gray-50 p-3">
        <p className="mb-2 text-xs font-medium text-gray-600">Create Invoice</p>
        <TextInput
          label="Amount (CKB)"
          state={[amount, setAmount]}
          placeholder="1"
        />
        <TextInput
          label="Description (optional)"
          state={[desc, setDesc]}
          placeholder="Payment for..."
        />
        <div className="mt-3 flex justify-end">
          <Button
            variant="primary"
            className="text-sm"
            disabled={!amount}
            onClick={() =>
              onNew(amount, desc).then((r) => setInvoiceAddr(r.invoice_address))
            }
          >
            Create
          </Button>
        </div>
        {invoiceAddr && (
          <div className="mt-3 flex items-center gap-2 rounded-lg bg-green-50 p-2">
            <p className="min-w-0 flex-1 font-mono text-xs break-all text-green-700">
              {invoiceAddr}
            </p>
            <button
              className="shrink-0 text-green-500 hover:text-green-700"
              onClick={() => navigator.clipboard.writeText(invoiceAddr)}
            >
              <Copy size={14} />
            </button>
          </div>
        )}
      </div>

      <div className="rounded-lg border border-gray-100 bg-gray-50 p-3">
        <p className="mb-2 text-xs font-medium text-gray-600">
          Check Invoice Status
        </p>
        <TextInput
          label="Payment Hash (0x...)"
          state={[hash, setHash]}
          placeholder="0x..."
        />
        <div className="mt-3 flex items-center justify-between">
          <Button
            variant="info"
            className="text-sm"
            disabled={!hash}
            onClick={() => onCheck(hash).then((r) => setStatus(r.status))}
          >
            Check
          </Button>
          {status && (
            <span
              className={`rounded-full px-3 py-1 text-xs font-medium ${
                INVOICE_STATUS_COLOR[status] ?? "bg-gray-100 text-gray-600"
              }`}
            >
              {status}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Payments tab ──────────────────────────────────────────────────────────────

export function PaymentsTab({
  onSend,
}: {
  onSend: (invoice: string) => Promise<void>;
}) {
  const [invoice, setInvoice] = useState("");
  const [result, setResult] = useState("");

  return (
    <div className="space-y-3">
      <TextInput
        label="Invoice Address"
        state={[invoice, setInvoice]}
        placeholder="fibt1..."
      />
      <div className="flex justify-end">
        <Button
          variant="primary"
          className="flex items-center gap-1 text-sm"
          disabled={!invoice}
          onClick={() =>
            onSend(invoice)
              .then(() => setResult("Payment sent"))
              .catch((e: unknown) =>
                setResult(
                  `Failed: ${e instanceof Error ? e.message : String(e)}`,
                ),
              )
          }
        >
          <Send size={13} /> Send Payment
        </Button>
      </div>
      {result && (
        <div className="rounded-lg bg-blue-50 px-3 py-2">
          <p className="text-xs text-blue-700">{result}</p>
        </div>
      )}
    </div>
  );
}

// ── Graph tab ─────────────────────────────────────────────────────────────────

function formatTimestamp(hex: string): string {
  try {
    let ms = Number(BigInt(hex));
    if (ms < 1e10) ms *= 1000;
    return new Date(ms).toLocaleDateString("en", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return "—";
  }
}

export function GraphTab({
  nodes,
  onFetch,
}: {
  nodes: FjGraphNode[];
  onFetch: () => Promise<void>;
}) {
  const [search, setSearch] = useState("");

  const filtered =
    search.trim() === ""
      ? nodes
      : nodes.filter((n) =>
          n.pubkey.toLowerCase().includes(search.trim().toLowerCase()),
        );

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <div className="flex-1">
          <TextInput
            label="Search by pubkey"
            state={[search, setSearch]}
            placeholder="0260..."
          />
        </div>
        <div className="flex items-end pb-4">
          <Button variant="info" className="text-sm" onClick={onFetch}>
            Fetch
          </Button>
        </div>
      </div>

      <p className="flex items-center gap-1 text-xs font-medium text-gray-500">
        <Network size={13} /> Network nodes (
        {search.trim() !== "" && filtered.length !== nodes.length
          ? `${filtered.length} / ${nodes.length}`
          : nodes.length}
        )
      </p>

      <div className="max-h-72 overflow-y-auto rounded-lg border border-gray-100 bg-gray-50">
        {filtered.length === 0 ? (
          <p className="py-6 text-center text-sm text-gray-300">
            {nodes.length === 0
              ? "Press Fetch to load network nodes."
              : "No nodes match the search."}
          </p>
        ) : (
          <div className="divide-y divide-gray-100">
            {/* Header */}
            <div className="flex items-center gap-3 px-3 py-1.5 text-xs font-semibold text-gray-400">
              <span className="w-30 shrink-0">Name</span>
              <span className="min-w-0 flex-1">Pubkey</span>
              <span className="w-28 shrink-0 text-right">Min CKB</span>
              <span className="w-32 shrink-0 text-right">Joined</span>
            </div>
            {filtered.map((n) => (
              <div
                key={n.pubkey}
                className="flex items-center gap-3 px-3 py-1.5 text-xs hover:bg-gray-100"
              >
                <span
                  className="w-30 shrink-0 truncate font-medium text-gray-700"
                  title={n.node_name}
                >
                  {n.node_name || "—"}
                </span>
                <span
                  className="min-w-0 flex-1 truncate font-mono text-gray-500"
                  title={n.pubkey}
                >
                  {n.pubkey}
                </span>
                <span className="w-28 shrink-0 text-right text-gray-500">
                  {hexToCkb(n.auto_accept_min_ckb_funding_amount)} CKB
                </span>
                <span className="w-32 shrink-0 text-right text-gray-400">
                  {formatTimestamp(n.timestamp)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Node info grid ────────────────────────────────────────────────────────────

function hexToNum(hex: string): string {
  return String(Number(ccc.numFrom(hex)));
}

export function NodeInfoGrid({
  nodeId,
  addresses,
  peersCount,
  channelCount,
  pendingChannelCount,
}: {
  nodeId: string;
  addresses: string[];
  peersCount: string;
  channelCount: string;
  pendingChannelCount: string;
}) {
  return (
    <div className="mt-4 space-y-3">
      <div className="grid grid-cols-3 gap-2">
        <InfoCard label="Peers" value={hexToNum(peersCount)} />
        <InfoCard label="Channels" value={hexToNum(channelCount)} />
        <InfoCard label="Pending" value={hexToNum(pendingChannelCount)} />
      </div>
      <div className="rounded-lg bg-gray-50 px-3 py-2">
        <p className="mb-1 text-xs text-gray-400">Node ID</p>
        <p className="font-mono text-xs break-all text-gray-600">{nodeId}</p>
      </div>
      {addresses.length > 0 && (
        <div className="rounded-lg bg-gray-50 px-3 py-2">
          <p className="mb-1 text-xs text-gray-400">Listening Addresses</p>
          {addresses.map((a, i) => (
            <p key={i} className="truncate font-mono text-xs text-gray-600">
              {a}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}
