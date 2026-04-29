"use client";

import { Button } from "@/src/components/Button";
import { TextInput } from "@/src/components/Input";
import { useApp } from "@/src/context";
import {
  ChevronDown,
  ChevronUp,
  Copy,
  HelpCircle,
  Key,
  Play,
  RefreshCw,
  Settings,
  Square,
  Trash2,
  Wifi,
  WifiOff,
} from "lucide-react";
import { useMemo, useState } from "react";
import {
  Card,
  ChannelsTab,
  InvoicesTab,
  LogPanel,
  NodeInfoGrid,
  PaymentsTab,
  PeersTab,
  TabBar,
} from "./components";
import {
  LS_MANUAL_CONFIG,
  maskKey,
  readLs,
  SIGN_MESSAGE,
  writeLs,
} from "./config";
import { useActivityLog, useFiberNode, useNodeKey } from "./hooks";
import type { Tab } from "./types";

export default function FiberPage() {
  const { signer, createSender } = useApp();
  const { log, error } = createSender("Fiber");

  // ── Config (persisted) ───────────────────────────────────────────────────────
  const [manualConfig, setManualConfig] = useState(() =>
    readLs(LS_MANUAL_CONFIG, ""),
  );
  const [configOpen, setConfigOpen] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>("peers");

  // ── Signing message (editable by the user) ───────────────────────────────────
  const [signMessage, setSignMessage] = useState(SIGN_MESSAGE);

  // ── Hooks ────────────────────────────────────────────────────────────────────
  const { logs, addLog, clearLogs } = useActivityLog();
  const { walletAddr, storedKey, deriveKeys, keysFromStored } = useNodeKey(
    signer,
    addLog,
  );
  const node = useFiberNode(signer, addLog);

  // ── Derived values ───────────────────────────────────────────────────────────
  const dbPrefix = useMemo(
    () => `/fiber-demo-${walletAddr.slice(0, 12)}`,
    [walletAddr],
  );

  // ── Handlers ─────────────────────────────────────────────────────────────────
  const handleStart = async () => {
    const fiberKey = keysFromStored() ?? (await deriveKeys(signMessage));
    if (!fiberKey) {
      return;
    }
    try {
      await node.startNode({
        fiberKey,
        dbPrefix,
        configYaml: manualConfig || undefined,
      });
      log("Fiber node started");
    } catch {
      error("Fiber node failed to start");
    }
  };

  const handleStop = async () => {
    await node.stopNode();
    log("Fiber node stopped");
  };

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <div className="flex w-full flex-col gap-4 pb-8">
      {/* Config */}
      <Card>
        <button
          className="flex w-full items-center justify-between px-4 py-3 text-left"
          onClick={() => setConfigOpen((v) => !v)}
        >
          <span className="flex items-center gap-2 text-sm font-semibold text-gray-700">
            <Settings size={15} /> Node Configuration
          </span>
          {configOpen ? (
            <ChevronUp size={15} className="text-gray-400" />
          ) : (
            <ChevronDown size={15} className="text-gray-400" />
          )}
        </button>
        {configOpen && (
          <div className="border-t border-gray-100 px-4 py-3">
            <textarea
              className="h-64 w-full resize-y rounded-lg border border-gray-200 bg-gray-50 p-3 font-mono text-xs text-gray-700 focus:border-gray-400 focus:outline-none"
              value={manualConfig}
              onChange={(e) => {
                const v = e.currentTarget.value;
                setManualConfig(v);
                writeLs(LS_MANUAL_CONFIG, v);
              }}
              spellCheck={false}
            />
            <p className="mt-1 text-xs text-gray-400">
              Full YAML passed directly to the fiber node. Leave empty to use
              the auto-generated default config.
            </p>
          </div>
        )}
      </Card>

      {/* Identity key — overflow-visible so the signing-message tooltip can
           escape the card boundary upward without being clipped */}
      {signer && (
        <Card className="!overflow-visible">
          <div className="px-4 py-3">
            <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-gray-700">
              <Key size={15} /> Node Identity Key
            </h2>

            {/* Editable signing message.
                 The HelpCircle is overlaid after the label text via an
                 invisible ghost span so TextInput keeps label as string. */}
            <div className="relative">
              <TextInput
                label="Signing Message"
                state={[signMessage, setSignMessage]}
                placeholder={SIGN_MESSAGE}
              />
              <div className="pointer-events-none absolute top-4 left-4 flex items-center gap-1.5">
                <span className="invisible text-sm">Signing Message</span>
                <span className="group pointer-events-auto relative inline-flex">
                  <HelpCircle
                    size={16}
                    className="cursor-help text-gray-400 hover:text-gray-600"
                  />
                  <span className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-2 w-72 -translate-x-1/2 rounded-lg bg-gray-800 px-3 py-2 text-xs leading-relaxed font-normal text-gray-100 opacity-0 shadow-lg transition-opacity group-hover:opacity-100">
                    Your wallet signs this text once to deterministically derive
                    a secp256k1 private key:
                    <br />
                    <br />
                    <span className="font-mono text-sky-300">fiberKey</span>
                    {" = hashCkb(signature)"} — Fiber P2P identity
                    <br />
                    <br />
                    CKB channel funding transactions are signed by your
                    connected wallet directly via CCC. The same message always
                    produces the same node identity. Changing it gives you a
                    completely different node identity.
                    <span className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-800" />
                  </span>
                </span>
              </div>
            </div>

            {storedKey && (
              <div className="mb-3">
                <div className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2">
                  <span className="font-mono text-sm text-gray-600">
                    {maskKey(storedKey)}
                  </span>
                  <button
                    className="ml-3 text-gray-400 hover:text-gray-700"
                    onClick={() => {
                      navigator.clipboard.writeText(storedKey);
                      addLog("info", "Key copied.");
                    }}
                  >
                    <Copy size={14} />
                  </button>
                </div>
              </div>
            )}

            <div className="mt-3 flex justify-end">
              <Button
                variant="info"
                className="text-sm"
                onClick={() => deriveKeys(signMessage)}
              >
                {storedKey ? "Re-derive Key" : "Sign & Derive Key"}
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* Node runtime */}
      <Card>
        <div className="px-4 py-3">
          <div className="flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-gray-700">
              {node.isRunning ? (
                <Wifi size={15} className="text-green-500" />
              ) : (
                <WifiOff size={15} className="text-gray-400" />
              )}
              Fiber Node
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                  node.isRunning
                    ? "bg-green-100 text-green-700"
                    : "bg-gray-100 text-gray-400"
                }`}
              >
                {node.isRunning ? "Running" : "Stopped"}
              </span>
              {node.nodeInfo?.version && (
                <span className="font-mono text-xs font-normal text-gray-400">
                  v{node.nodeInfo.version}
                </span>
              )}
            </h2>
            <div className="flex items-center gap-2">
              {node.isRunning && (
                <Button
                  variant="info"
                  className="flex items-center gap-1 text-sm"
                  disabled={node.isRefreshing}
                  onClick={node.refreshNodeData}
                >
                  <RefreshCw
                    size={13}
                    className={node.isRefreshing ? "animate-spin" : ""}
                  />
                  Refresh
                </Button>
              )}
              {node.isRunning ? (
                <Button
                  variant="danger"
                  className="flex items-center gap-1 text-sm"
                  onClick={handleStop}
                >
                  <Square size={13} /> Stop
                </Button>
              ) : (
                <Button
                  variant="success"
                  className="flex items-center gap-1 text-sm"
                  disabled={node.isStarting || !signer || !storedKey}
                  title={
                    !signer
                      ? "Connect a wallet first"
                      : !storedKey
                        ? "Sign & derive your node key first"
                        : undefined
                  }
                  onClick={handleStart}
                >
                  <Play size={13} />
                  {node.isStarting ? "Starting…" : "Start"}
                </Button>
              )}
              <Button
                variant="danger"
                className="flex items-center gap-1 text-sm"
                disabled={node.isStarting || !walletAddr}
                onClick={() => node.clearNodeData(dbPrefix)}
                title="Delete all local IndexedDB data for this node and start fresh"
              >
                <Trash2 size={13} /> Clear Data
              </Button>
            </div>
          </div>
          {node.nodeInfo && (
            <NodeInfoGrid
              nodeId={node.nodeInfo.pubkey}
              addresses={node.nodeInfo.addresses}
              peersCount={node.nodeInfo.peers_count}
              channelCount={node.nodeInfo.channel_count}
              pendingChannelCount={node.nodeInfo.pending_channel_count}
            />
          )}
        </div>
      </Card>

      {/* Tabbed operations */}
      {node.isRunning && (
        <Card>
          <TabBar active={activeTab} onChange={setActiveTab} />
          <div className="p-4">
            {activeTab === "peers" && (
              <PeersTab
                peers={node.peers}
                onConnect={node.connectPeer}
                onDisconnect={node.disconnectPeer}
              />
            )}
            {activeTab === "channels" && (
              <ChannelsTab
                channels={node.channels}
                onOpen={(peerId, amount, isPublic) =>
                  node
                    .openChannel(peerId, amount, isPublic)
                    .then(() => undefined)
                }
                onClose={node.shutdownChannel}
              />
            )}
            {activeTab === "invoices" && (
              <InvoicesTab onNew={node.newInvoice} onCheck={node.getInvoice} />
            )}
            {activeTab === "payments" && (
              <PaymentsTab
                onSend={(inv) => node.sendPayment(inv).then(() => undefined)}
              />
            )}
          </div>
        </Card>
      )}

      <LogPanel logs={logs} onClear={clearLogs} />
    </div>
  );
}
