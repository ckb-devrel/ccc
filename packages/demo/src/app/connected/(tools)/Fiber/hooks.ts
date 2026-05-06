import { ccc } from "@ckb-ccc/connector-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { lsNodeKeyFor, readLs, writeLs } from "./config";
import type {
  CkbRpcScript,
  CkbRpcTransaction,
  FiberInstance,
  FjChannel,
  FjGetInvoice,
  FjGraphNode,
  FjInvoice,
  FjNodeInfo,
  FjOpenChannel,
  FjPayment,
  FjPeer,
  LogEntry,
  LogLevel,
} from "./types";

// ── Shared helpers ────────────────────────────────────────────────────────────

function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

async function resolveLockCellDeps(
  client: ccc.Client,
  lock: ccc.Script,
): Promise<CkbRpcTransaction["cell_deps"]> {
  const infos = await Promise.all(
    Object.values(ccc.KnownScript).map((ks) => client.getKnownScript(ks)),
  );
  for (const info of infos) {
    if (info.codeHash !== lock.codeHash || info.hashType !== lock.hashType) {
      continue;
    }
    const deps = await client.getCellDeps(...info.cellDeps);
    return deps.map((dep) => ({
      dep_type: dep.depType === "depGroup" ? "dep_group" : ("code" as const),
      out_point: {
        tx_hash: ccc.hexFrom(dep.outPoint.txHash),
        index: ccc.numToHex(dep.outPoint.index),
      },
    }));
  }
  return [];
}

const MAX_LOGS = 500;

// ── Activity log ──────────────────────────────────────────────────────────────

type AddLog = (level: LogLevel, msg: string) => void;

export function useActivityLog() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const idRef = useRef(0);

  const addLog = useCallback((level: LogLevel, msg: string) => {
    const id = ++idRef.current;
    const time = new Date().toLocaleTimeString("en", { hour12: false });
    setLogs((prev) => [...prev, { id, level, time, msg }].slice(-MAX_LOGS));
  }, []);

  return { logs, addLog, clearLogs: () => setLogs([]) };
}

// ── Node identity key ─────────────────────────────────────────────────────────

export function useNodeKey(signer: ccc.Signer | undefined, addLog: AddLog) {
  const [walletAddr, setWalletAddr] = useState("");
  const [storedKey, setStoredKey] = useState<string | null>(null);

  useEffect(() => {
    if (!signer) {
      return;
    }
    let cancelled = false;
    signer.getInternalAddress().then((addr) => {
      if (cancelled) {
        return;
      }
      setWalletAddr(addr);
      const saved = readLs(lsNodeKeyFor(addr));
      if (saved) {
        setStoredKey(saved);
        addLog("info", `Loaded stored node key for ${addr.slice(0, 12)}…`);
      }
    });
    return () => {
      cancelled = true;
      setWalletAddr("");
      setStoredKey(null);
    };
  }, [signer, addLog]);

  const deriveKeys = useCallback(
    async (message: string): Promise<Uint8Array | null> => {
      if (!signer || !walletAddr) return null;
      addLog("info", `Signing "${message}"…`);
      try {
        const sig = await signer.signMessage(message);
        const sigBytes = ccc.bytesFrom(sig.signature);
        const fiberKeyHex = ccc.hashCkb(sigBytes);
        setStoredKey(fiberKeyHex);
        writeLs(lsNodeKeyFor(walletAddr), fiberKeyHex);
        addLog("success", "Node identity key derived and persisted.");
        return ccc.bytesFrom(fiberKeyHex);
      } catch (e) {
        addLog("error", `Key derivation failed: ${errMsg(e)}`);
        return null;
      }
    },
    [signer, walletAddr, addLog],
  );

  // Avoids wallet pop-ups on COOP-restricted pages; uses the already-stored key.
  const keysFromStored = useCallback((): Uint8Array | null => {
    if (!storedKey) return null;
    return ccc.bytesFrom(storedKey);
  }, [storedKey]);

  return { walletAddr, storedKey, deriveKeys, keysFromStored };
}

// ── Fiber node lifecycle & RPC ────────────────────────────────────────────────

export interface StartOptions {
  fiberKey: Uint8Array;
  dbPrefix: string;
  configYaml: string | undefined;
}

export function useFiberNode(signer: ccc.Signer | undefined, addLog: AddLog) {
  const fiberRef = useRef<FiberInstance | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [nodeInfo, setNodeInfo] = useState<FjNodeInfo | null>(null);
  const [peers, setPeers] = useState<FjPeer[]>([]);
  const [channels, setChannels] = useState<FjChannel[]>([]);
  const [graphNodes, setGraphNodes] = useState<FjGraphNode[]>([]);

  useEffect(
    () => () => {
      fiberRef.current?.stop().catch(() => undefined);
    },
    [],
  );

  // Redirect console output to the activity log while the node is running.
  useEffect(() => {
    if (!isRunning) {
      return;
    }
    const levels = [
      ["log", "info"],
      ["warn", "warn"],
      ["error", "error"],
    ] as const;
    const originals = levels.map(([method]) => console[method].bind(console));
    levels.forEach(([method, level], i) => {
      console[method] = (...a: unknown[]) => {
        originals[i](...a);
        addLog(level, a.map(String).join(" "));
      };
    });
    return () => {
      levels.forEach(([method], i) => {
        console[method] = originals[i];
      });
    };
  }, [isRunning, addLog]);

  function invoke<T>(name: string, args?: unknown[]): Promise<T> {
    if (!fiberRef.current) throw new Error("Fiber node is not running");
    return fiberRef.current.invokeCommand(name, args) as Promise<T>;
  }

  const logResponse = useCallback(
    (method: string, result: unknown) => {
      const text =
        result === undefined || result === null
          ? "null"
          : JSON.stringify(result);
      addLog("success", `${method} → ${text}`);
    },
    [addLog],
  );

  function resetState() {
    setIsRunning(false);
    setNodeInfo(null);
    setPeers([]);
    setChannels([]);
    setGraphNodes([]);
  }

  const refreshNodeData = useCallback(async () => {
    if (!fiberRef.current) {
      return;
    }
    setIsRefreshing(true);
    addLog("info", "Refreshing node data…");
    try {
      const [info, peerRes, chanRes] = await Promise.all([
        invoke<FjNodeInfo>("node_info"),
        invoke<{ peers: FjPeer[] }>("list_peers"),
        invoke<{ channels: FjChannel[] }>("list_channels", [{}]),
      ]);
      logResponse("node_info", info);
      logResponse("list_peers", peerRes);
      logResponse("list_channels", chanRes);
      setNodeInfo(info);
      setPeers(peerRes.peers ?? []);
      setChannels(chanRes.channels ?? []);
    } catch (e) {
      addLog("error", `Refresh failed: ${errMsg(e)}`);
    } finally {
      setIsRefreshing(false);
    }
  }, [addLog, logResponse]);

  const startNode = useCallback(
    async (opts: StartOptions) => {
      setIsStarting(true);
      try {
        if (!opts.configYaml) {
          addLog(
            "warn",
            "No YAML config provided — please fill in the Node Configuration before starting.",
          );
          return;
        }
        addLog("info", "Starting fiber node…");
        const { Fiber } = await import("@nervosnetwork/fiber-js");
        const fiber = new Fiber();
        await fiber.start(
          opts.configYaml,
          opts.fiberKey,
          undefined,
          undefined,
          "info",
          opts.dbPrefix,
        );
        const readyProbe = await fiber.invokeCommand("list_channels", [{}]);
        fiberRef.current = fiber;
        logResponse("list_channels (ready probe)", readyProbe);
        setIsRunning(true);
        await refreshNodeData();
      } catch (e) {
        addLog("error", `Node start failed: ${errMsg(e)}`);
        throw e;
      } finally {
        setIsStarting(false);
      }
    },
    [addLog, logResponse, refreshNodeData],
  );

  const stopNode = useCallback(async () => {
    addLog("info", "Stopping fiber node…");
    await fiberRef.current?.stop().catch(() => undefined);
    fiberRef.current = null;
    resetState();
    addLog("info", "Fiber node stopped.");
  }, [addLog]);

  const clearNodeData = useCallback(
    async (dbPrefix: string) => {
      if (fiberRef.current) {
        addLog("info", "Stopping fiber node before clearing data…");
        await fiberRef.current.stop().catch(() => undefined);
        fiberRef.current = null;
        resetState();
      }
      addLog("info", `Deleting IndexedDB databases with prefix "${dbPrefix}"…`);
      try {
        const dbs = await indexedDB.databases();
        const targets = dbs.filter((d) => d.name?.startsWith(dbPrefix));
        if (targets.length === 0) {
          addLog("warn", "No fiber databases found for this wallet.");
          return;
        }
        await Promise.all(
          targets.map(
            (d) =>
              new Promise<void>((resolve, reject) => {
                const req = indexedDB.deleteDatabase(d.name!);
                req.onsuccess = () => resolve();
                req.onerror = () => reject(req.error);
                req.onblocked = () =>
                  addLog(
                    "warn",
                    `Deletion of "${d.name}" is blocked — close other tabs.`,
                  );
              }),
          ),
        );
        addLog(
          "success",
          `Cleared ${targets.length} database(s). Start the node to begin fresh.`,
        );
      } catch (e) {
        addLog("error", `Failed to clear data: ${errMsg(e)}`);
      }
    },
    [addLog],
  );

  const connectPeer = useCallback(
    async (address: string) => {
      addLog("info", `Connecting to peer: ${address}`);
      const connectResult = await invoke("connect_peer", [
        { address, save: true },
      ]);
      logResponse("connect_peer", connectResult);
    },
    [addLog, logResponse],
  );

  const disconnectPeer = useCallback(
    async (peerId: string) => {
      addLog("info", `Disconnecting peer: ${peerId.slice(0, 20)}…`);
      const disconnectResult = await invoke("disconnect_peer", [
        { pubkey: peerId },
      ]);
      logResponse("disconnect_peer", disconnectResult);
    },
    [addLog, logResponse],
  );

  const openChannel = useCallback(
    async (
      peerId: string,
      fundingAmount: string,
      isPublic: boolean,
    ): Promise<FjOpenChannel> => {
      if (!signer) throw new Error("No signer connected");

      addLog("info", `Opening channel with ${peerId.slice(0, 20)}…`);

      const addr = await signer.getRecommendedAddressObj();
      const lock = addr.script;
      const lockRpc: CkbRpcScript = {
        code_hash: ccc.hexFrom(lock.codeHash),
        hash_type: lock.hashType,
        args: ccc.hexFrom(lock.args),
      };

      const lockCellDeps = await resolveLockCellDeps(signer.client, lock);

      const openResult = await fiberRef.current!.openChannelWithExternalFunding(
        {
          pubkey: peerId,
          funding_amount: ccc.numToHex(ccc.fixedPointFrom(fundingAmount, 8)),
          public: isPublic,
          shutdown_script: lockRpc,
          funding_lock_script: lockRpc,
          funding_lock_script_cell_deps:
            lockCellDeps.length > 0 ? lockCellDeps : undefined,
        },
      );
      logResponse("open_channel_with_external_funding", {
        channel_id: openResult.channel_id,
      });

      // Convert unsigned CKB JSON-RPC tx → ccc.Transaction
      const rpc = openResult.unsigned_funding_tx;
      const ccTx = ccc.Transaction.from({
        version: rpc.version,
        cellDeps: rpc.cell_deps.map((d) => ({
          depType: d.dep_type === "dep_group" ? "depGroup" : "code",
          outPoint: { txHash: d.out_point.tx_hash, index: d.out_point.index },
        })),
        headerDeps: rpc.header_deps,
        inputs: rpc.inputs.map((i) => ({
          previousOutput: {
            txHash: i.previous_output.tx_hash,
            index: i.previous_output.index,
          },
          since: i.since,
        })),
        outputs: rpc.outputs.map((o) => ({
          capacity: o.capacity,
          lock: {
            codeHash: o.lock.code_hash,
            hashType: o.lock.hash_type,
            args: o.lock.args,
          },
          type: o.type
            ? {
                codeHash: o.type.code_hash,
                hashType: o.type.hash_type,
                args: o.type.args,
              }
            : undefined,
        })),
        outputsData: rpc.outputs_data,
        witnesses: rpc.witnesses,
      });

      // Populate live-cell data so the signer can compute the signing hash
      for (const input of ccTx.inputs) {
        const cell = await signer.client.getCell(input.previousOutput);
        if (cell) {
          input.cellOutput = cell.cellOutput;
          input.outputData = cell.outputData;
        }
      }

      addLog("info", "Signing funding transaction…");
      const signedTx = await signer.signOnlyTransaction(ccTx);

      // Convert signed ccc.Transaction back to CKB JSON-RPC format
      const signedRpc: CkbRpcTransaction = {
        version: ccc.numToHex(signedTx.version),
        cell_deps: signedTx.cellDeps.map((d) => ({
          dep_type: d.depType === "depGroup" ? "dep_group" : "code",
          out_point: {
            tx_hash: ccc.hexFrom(d.outPoint.txHash),
            index: ccc.numToHex(d.outPoint.index),
          },
        })),
        header_deps: signedTx.headerDeps.map((h) => ccc.hexFrom(h)),
        inputs: signedTx.inputs.map((i) => ({
          previous_output: {
            tx_hash: ccc.hexFrom(i.previousOutput.txHash),
            index: ccc.numToHex(i.previousOutput.index),
          },
          since: ccc.numToHex(i.since),
        })),
        outputs: signedTx.outputs.map((o) => ({
          capacity: ccc.numToHex(o.capacity),
          lock: {
            code_hash: ccc.hexFrom(o.lock.codeHash),
            hash_type: o.lock.hashType,
            args: ccc.hexFrom(o.lock.args),
          },
          type: o.type
            ? {
                code_hash: ccc.hexFrom(o.type.codeHash),
                hash_type: o.type.hashType,
                args: ccc.hexFrom(o.type.args),
              }
            : undefined,
        })),
        outputs_data: signedTx.outputsData.map((d) => ccc.hexFrom(d)),
        witnesses: signedTx.witnesses.map((w) => ccc.hexFrom(w)),
      };

      addLog("info", "Submitting signed funding transaction…");
      const submitResult = await fiberRef.current!.submitSignedFundingTx({
        channel_id: openResult.channel_id,
        signed_funding_tx: signedRpc,
      });
      logResponse("submit_signed_funding_tx", submitResult);
      return { channel_id: submitResult.channel_id };
    },
    [signer, addLog, logResponse],
  );

  const shutdownChannel = useCallback(
    async (channelId: string) => {
      addLog("info", `Closing channel ${channelId.slice(0, 18)}…`);
      const result = await invoke("shutdown_channel", [
        { channel_id: channelId },
      ]);
      logResponse("shutdown_channel", result);
    },
    [addLog, logResponse],
  );

  const newInvoice = useCallback(
    async (amount: string, description: string): Promise<FjInvoice> => {
      addLog("info", `Creating invoice for ${amount} CKB…`);
      const preimage = ccc.hexFrom(crypto.getRandomValues(new Uint8Array(32)));
      const result = await invoke<FjInvoice>("new_invoice", [
        {
          amount: ccc.numToHex(ccc.fixedPointFrom(amount, 8)),
          currency: "Fibt",
          payment_preimage: preimage,
          description: description || undefined,
          expiry: ccc.numToHex(3600),
          final_expiry_delta: ccc.numToHex(9600000),
        },
      ]);
      logResponse("new_invoice", result);
      return result;
    },
    [addLog, logResponse],
  );

  const getInvoice = useCallback(
    async (paymentHash: string): Promise<FjGetInvoice> => {
      addLog("info", `Checking invoice ${paymentHash.slice(0, 18)}…`);
      const result = await invoke<FjGetInvoice>("get_invoice", [
        { payment_hash: paymentHash },
      ]);
      logResponse("get_invoice", result);
      return result;
    },
    [addLog, logResponse],
  );

  const sendPayment = useCallback(
    async (invoice: string): Promise<FjPayment> => {
      addLog("info", "Sending payment…");
      const result = await invoke<FjPayment>("send_payment", [{ invoice }]);
      logResponse("send_payment", result);
      return result;
    },
    [addLog, logResponse],
  );

  const fetchGraphNodes = useCallback(async () => {
    addLog("info", "Fetching network graph nodes…");
    try {
      const all: FjGraphNode[] = [];
      let after: string | undefined;
      const limit = 100;
      while (true) {
        const params: Record<string, string> = {
          limit: ccc.numToHex(limit),
        };
        if (after) params.after = after;
        const res = await invoke<{ nodes: FjGraphNode[]; last_cursor: string }>(
          "graph_nodes",
          [params],
        );
        const batch = res.nodes ?? [];
        all.push(...batch);
        if (batch.length < limit) break;
        after = res.last_cursor;
        if (!after || after === "0x") break;
      }
      setGraphNodes(all);
      addLog("success", `Fetched ${all.length} graph node(s).`);
    } catch (e) {
      addLog("error", `Failed to fetch graph nodes: ${errMsg(e)}`);
    }
  }, [addLog]);

  return {
    isRunning,
    isStarting,
    isRefreshing,
    nodeInfo,
    peers,
    channels,
    graphNodes,
    startNode,
    stopNode,
    clearNodeData,
    refreshNodeData,
    connectPeer,
    disconnectPeer,
    openChannel,
    shutdownChannel,
    newInvoice,
    getInvoice,
    sendPayment,
    fetchGraphNodes,
  };
}
