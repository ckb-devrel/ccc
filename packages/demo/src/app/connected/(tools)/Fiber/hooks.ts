import { ccc } from "@ckb-ccc/connector-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { lsNodeKeyFor, readLs, writeLs } from "./config";
import type {
  FiberInstance,
  FjChannel,
  FjGetInvoice,
  FjInvoice,
  FjNodeInfo,
  FjOpenChannel,
  FjPayment,
  FjPeer,
  LogEntry,
  LogLevel,
} from "./types";

// ── Shared helpers ────────────────────────────────────────────────────────────

/** Extracts a human-readable message from an unknown thrown value. */
function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
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

/**
 * Manages the node identity key derived from the connected wallet.
 *
 * On each wallet connection the hook checks localStorage for a previously
 * derived key. When the user explicitly calls `deriveKeys()` the wallet signs
 * SIGN_MESSAGE; the signature is hashed twice (via `hashCkb`) to produce two
 * independent 32-byte secp256k1 private keys:
 *   fiberKey = hashCkb(sig)        — P2P identity
 *   ckbKey   = hashCkb(fiberKey)   — CKB transaction signing
 */
export function useNodeKey(signer: ccc.Signer | undefined, addLog: AddLog) {
  const [walletAddr, setWalletAddr] = useState("");
  const [storedKey, setStoredKey] = useState<string | null>(null);

  useEffect(() => {
    if (!signer) return;
    let cancelled = false;
    signer.getInternalAddress().then((addr) => {
      if (cancelled) return;
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

  /**
   * Signs SIGN_MESSAGE and derives the two key pairs.
   * @returns [fiberKeyBytes, ckbKeyBytes] on success, or null on failure.
   */
  const deriveKeys = useCallback(
    async (message: string): Promise<[Uint8Array, Uint8Array] | null> => {
      if (!signer || !walletAddr) return null;
      addLog("info", `Signing "${message}"…`);
      try {
        const sig = await signer.signMessage(message);
        const sigBytes = new TextEncoder().encode(sig.signature);
        const fiberKeyHex = ccc.hashCkb(sigBytes);
        const ckbKeyHex = ccc.hashCkb(ccc.bytesFrom(fiberKeyHex));
        setStoredKey(fiberKeyHex);
        writeLs(lsNodeKeyFor(walletAddr), fiberKeyHex);
        addLog("success", "Node identity key derived and persisted.");
        return [ccc.bytesFrom(fiberKeyHex), ccc.bytesFrom(ckbKeyHex)];
      } catch (e) {
        addLog("error", `Key derivation failed: ${errMsg(e)}`);
        return null;
      }
    },
    [signer, walletAddr, addLog],
  );

  /**
   * Rehydrates the key pair from the stored fiberKeyHex without signing.
   * Use this on the COOP-restricted Fiber page where wallet pop-ups are broken.
   */
  const keysFromStored = useCallback((): [Uint8Array, Uint8Array] | null => {
    if (!storedKey) return null;
    const fiberKeyBytes = ccc.bytesFrom(storedKey);
    const ckbKeyBytes = ccc.bytesFrom(ccc.hashCkb(fiberKeyBytes));
    return [fiberKeyBytes, ckbKeyBytes];
  }, [storedKey]);

  return { walletAddr, storedKey, deriveKeys, keysFromStored };
}

// ── CKB address & balance derived from the stored node key ────────────────────

/**
 * Derives the secp256k1_sighash CKB address and live-cell balance from the
 * stored fiber key.  The ckbKey is hashCkb(fiberKey); a temporary
 * SignerCkbPrivateKey is created against the connector's client so the
 * address matches whatever network the user has selected.
 */
export function useCkbKeyInfo(storedKey: string | null, addLog: AddLog) {
  const { client } = ccc.useCcc();
  const [ckbAddress, setCkbAddress] = useState<string>("");
  const [ckbBalance, setCkbBalance] = useState<bigint | null>(null);
  const [isLoadingBalance, setIsLoadingBalance] = useState(false);

  // Memoised signer — recreated only when the key or network changes.
  const ckbSigner = useMemo(() => {
    if (!storedKey) return null;
    const ckbKeyHex = ccc.hashCkb(ccc.bytesFrom(storedKey));
    return new ccc.SignerCkbPrivateKey(client, ckbKeyHex);
  }, [storedKey, client]);

  // Derive address whenever the signer changes.
  useEffect(() => {
    if (!ckbSigner) {
      setCkbAddress("");
      setCkbBalance(null);
      return;
    }
    ckbSigner
      .getInternalAddress()
      .then(setCkbAddress)
      .catch(() => undefined);
  }, [ckbSigner]);

  const refreshBalance = useCallback(async () => {
    if (!ckbSigner || !ckbAddress) return;
    setIsLoadingBalance(true);
    try {
      setCkbBalance(await ckbSigner.getBalance());
    } catch (e) {
      addLog("error", `CKB balance query failed: ${errMsg(e)}`);
    } finally {
      setIsLoadingBalance(false);
    }
  }, [ckbSigner, ckbAddress, addLog]);

  // Auto-fetch balance once the address is resolved.
  useEffect(() => {
    if (ckbAddress) refreshBalance();
  }, [ckbAddress, refreshBalance]);

  return { ckbAddress, ckbBalance, isLoadingBalance, refreshBalance };
}

// ── Fiber node lifecycle & RPC ────────────────────────────────────────────────

export interface StartOptions {
  fiberKey: Uint8Array;
  ckbKey: Uint8Array;
  dbPrefix: string;
  /** YAML config passed directly to the fiber node. */
  configYaml: string | undefined;
}

/**
 * Manages the lifecycle of an in-browser fiber node and all RPC operations
 * against it. All `invokeCommand` calls use the fiber-js snake_case wire format.
 */
export function useFiberNode(addLog: AddLog) {
  const fiberRef = useRef<FiberInstance | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [nodeInfo, setNodeInfo] = useState<FjNodeInfo | null>(null);
  const [peers, setPeers] = useState<FjPeer[]>([]);
  const [channels, setChannels] = useState<FjChannel[]>([]);

  useEffect(
    () => () => {
      fiberRef.current?.stop().catch(() => undefined);
    },
    [],
  );

  // Redirect console output to the activity log while the node is running.
  useEffect(() => {
    if (!isRunning) return;
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

  /** Serialise an RPC response for the activity log. */
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

  /** Resets all runtime node state to its idle defaults. */
  function resetState() {
    setIsRunning(false);
    setNodeInfo(null);
    setPeers([]);
    setChannels([]);
  }

  const refreshNodeData = useCallback(async () => {
    if (!fiberRef.current) return;
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
          opts.ckbKey,
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
      addLog("info", `Opening channel with ${peerId.slice(0, 20)}…`);
      const result = await invoke<FjOpenChannel>("open_channel", [
        {
          pubkey: peerId,
          funding_amount: ccc.numToHex(Math.round(Number(fundingAmount) * 1e8)),
          public: isPublic,
        },
      ]);
      logResponse("open_channel", result);
      return result;
    },
    [addLog, logResponse],
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
          amount: ccc.numToHex(ccc.numFrom(Math.round(Number(amount) * 1e8))),
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

  return {
    isRunning,
    isStarting,
    isRefreshing,
    nodeInfo,
    peers,
    channels,
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
  };
}
