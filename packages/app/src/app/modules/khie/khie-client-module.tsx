"use client";

import { ccc } from "@ckb-ccc/connector-react";
import { ArrowRight, Check, ChevronDown, ScanLine, X } from "lucide-react";
import {
  type CSSProperties,
  useCallback,
  useEffect,
  useEffectEvent,
  useRef,
  useState,
} from "react";
import { CopyableText } from "../../copyable-text";
import type { ModuleRuntimeProps } from "../../modules";
import { QrCode } from "../../qr-code";
import { QrScanner } from "../../qr-scanner";
import styles from "./khie-client-module.module.css";
import {
  DEFAULT_KHIE_RELAY_ADDRESS,
  type KhieRemotePeer,
  KhieSignerSession,
} from "./khie-signer-session";

type SignerWaiter = {
  abort: () => void;
  networkId: string;
  reject: (cause: Error) => void;
  resolve: (signer: ccc.Signer) => void;
  signal: AbortSignal;
};
type ApprovalPrompt = ccc.SignerJsonRpcConfirmation & {
  abort: () => void;
  resolve: (approved: boolean) => void;
  signal: AbortSignal;
};
type RelayState = "connected" | "connecting" | "failed" | "idle";

const ENDPOINT_URL = "https://app.ckbccc.com/#khie";
const JSON_RPC_REQUEST_TIMEOUT_MS = 120_000;

export function KhieClientModule({
  client,
  log,
  setClient,
  signer,
  signerIcon,
  signerName,
  show,
}: Pick<ModuleRuntimeProps, "client" | "log" | "setClient" | "show"> & {
  signer?: ccc.Signer;
  signerIcon?: string;
  signerName?: string;
}) {
  const [session, setSession] = useState<KhieSignerSession>();
  const [nodeReady, setNodeReady] = useState(false);
  const [pairingEndpoint, setPairingEndpoint] = useState("");
  const [paired, setPaired] = useState(false);
  const [pairing, setPairing] = useState(false);
  const [relayState, setRelayState] = useState<RelayState>("idle");
  const [relayAddress, setRelayAddress] = useState(DEFAULT_KHIE_RELAY_ADDRESS);
  const [khieEndpoint, setKhieEndpoint] = useState("");
  const [scanning, setScanning] = useState(false);
  const [advancedSettingsOpen, setAdvancedSettingsOpen] = useState(false);
  const [approval, setApproval] = useState<ApprovalPrompt>();
  const [queuedApprovalCount, setQueuedApprovalCount] = useState(0);
  const [remotePeer, setRemotePeer] = useState<KhieRemotePeer>();

  const signerRef = useRef(signer);
  const signerWaiters = useRef(new Set<SignerWaiter>());
  const approvalRef = useRef<ApprovalPrompt>(undefined);
  const approvalQueue = useRef<ApprovalPrompt[]>([]);

  const connectingRelay = relayState === "connecting";
  const relayConnected = relayState === "connected";
  const relayConnectionFailed = relayState === "failed";

  const showCurrent = useEffectEvent(show);
  const logCurrent = useEffectEvent(log);
  const reportCurrentError = useEffectEvent((cause: unknown) => {
    reportError(cause, show, log);
  });
  const getSignerMetadata = useEffectEvent(() => ({
    name: signerName,
    icon: signerIcon,
  }));
  const connectSigner = useEffectEvent(
    async (networkId: string, signal: AbortSignal) => {
      signal.throwIfAborted();
      const current = signerRef.current;
      if (
        current &&
        networkIdFromAddressPrefix(current.client.addressPrefix) === networkId
      ) {
        return current;
      }

      setClient(clientForNetworkId(networkId, client));

      return new Promise<ccc.Signer>((resolve, reject) => {
        const waiter: SignerWaiter = {
          abort: () => {
            if (!signerWaiters.current.delete(waiter)) {
              return;
            }
            signal.removeEventListener("abort", waiter.abort);
            reject(abortReason(signal));
          },
          networkId,
          reject,
          resolve,
          signal,
        };
        signerWaiters.current.add(waiter);
        signal.addEventListener("abort", waiter.abort, { once: true });
        if (signal.aborted) {
          waiter.abort();
          return;
        }
        resolveSignerWaiters(signerRef.current, signerWaiters.current);
      });
    },
  );
  const settleApproval = useCallback(
    (prompt: ApprovalPrompt, approved: boolean) => {
      if (approvalRef.current === prompt) {
        const next = approvalQueue.current.shift();
        approvalRef.current = next;
        setApproval(next);
      } else {
        const index = approvalQueue.current.indexOf(prompt);
        if (index === -1) {
          return false;
        }
        approvalQueue.current.splice(index, 1);
      }
      setQueuedApprovalCount(approvalQueue.current.length);

      prompt.signal.removeEventListener("abort", prompt.abort);
      prompt.resolve(approved);
      return true;
    },
    [],
  );
  const confirmKhieRequest = useEffectEvent(
    (request: ccc.SignerJsonRpcConfirmation, signal: AbortSignal) =>
      new Promise<boolean>((resolve) => {
        const prompt: ApprovalPrompt = {
          ...request,
          abort: () => void settleApproval(prompt, false),
          resolve,
          signal,
        };
        signal.addEventListener("abort", prompt.abort, { once: true });

        if (approvalRef.current) {
          approvalQueue.current.push(prompt);
          setQueuedApprovalCount(approvalQueue.current.length);
        } else {
          approvalRef.current = prompt;
          setApproval(prompt);
        }

        if (signal.aborted) {
          prompt.abort();
        }
      }),
  );
  const rejectPendingApprovals = useEffectEvent(() => {
    const prompts = [approvalRef.current, ...approvalQueue.current].filter(
      (prompt): prompt is ApprovalPrompt => prompt !== undefined,
    );
    approvalRef.current = undefined;
    approvalQueue.current = [];
    setApproval(undefined);
    setQueuedApprovalCount(0);
    prompts.forEach((prompt) => {
      prompt.signal.removeEventListener("abort", prompt.abort);
      prompt.resolve(false);
    });
  });
  const connectDefaultRelay = useEffectEvent(
    async (currentSession: KhieSignerSession) => {
      setRelayState("connecting");
      if (!(await currentSession.connectRelay(DEFAULT_KHIE_RELAY_ADDRESS))) {
        setRelayState("failed");
        return;
      }

      setRelayState("connected");
      logCurrent(`Relay connected: ${DEFAULT_KHIE_RELAY_ADDRESS}`, "success");
    },
  );

  const resolveApproval = (approved: boolean) => {
    const current = approvalRef.current;
    if (!current) {
      return;
    }

    if (!settleApproval(current, approved)) {
      return;
    }

    if (approved) {
      const title = formatApprovalTitle(current);
      show({
        label: "REQUEST APPROVED",
        tone: "success",
        content: <strong>{title} request approved</strong>,
      });
      log(`${title} request approved`, "success");
    }
  };

  useEffect(() => {
    signerRef.current = signer;
    resolveSignerWaiters(signer, signerWaiters.current);
  }, [signer]);

  useEffect(
    () => () => {
      rejectSignerWaiters(
        signerWaiters.current,
        new Error("Signer module stopped"),
      );
      rejectPendingApprovals();
    },
    [],
  );

  const pairEndpoint = useCallback(
    async (endpoint: string) => {
      const address = endpoint.trim();
      if (!session || !address) {
        return;
      }

      setPairing(true);
      try {
        if (await session.pair(address)) {
          setKhieEndpoint("");
        }
      } finally {
        setPairing(false);
      }
    },
    [session],
  );

  useEffect(() => {
    showCurrent({
      label: "STARTING LIBP2P",
      tone: "idle",
      content: <strong>Loading browser transports…</strong>,
    });
    logCurrent("Starting signer libp2p node");

    const owner = KhieSignerSession.open({
      endpointUrl: ENDPOINT_URL,
      handler: async (payload) => {
        const controller = new AbortController();
        const { signal } = controller;
        const reportTimeout = () => {
          if (!isTimeoutError(signal.reason)) {
            return;
          }

          const title = formatRequestTitle(payload.method);
          showCurrent({
            label: "REQUEST TIMED OUT",
            tone: "error",
            content: <strong>{title} request timed out</strong>,
          });
          logCurrent(`${title} request timed out`, "error");
        };
        signal.addEventListener("abort", reportTimeout, { once: true });
        const timeout = setTimeout(
          () => controller.abort(requestTimeoutError()),
          JSON_RPC_REQUEST_TIMEOUT_MS,
        );

        try {
          const handleRequest = ccc.buildSignerJsonRpcHandler({
            connect: (networkId) => connectSigner(networkId, signal),
            confirmRequest: (request) => confirmKhieRequest(request, signal),
            getSigner: () => signerRef.current,
            getSignerMetadata,
          });
          const result = await handleRequest(payload);
          signal.throwIfAborted();
          const completed = formatRequestCompletion(payload.method);
          if (completed) {
            showCurrent({
              label: "REQUEST COMPLETED",
              tone: "success",
              content: <strong>{completed}</strong>,
            });
            logCurrent(completed, "success");
          }
          return result;
        } catch (cause) {
          signal.throwIfAborted();
          throw cause;
        } finally {
          clearTimeout(timeout);
          signal.removeEventListener("abort", reportTimeout);
        }
      },
      onEndpointChange: setPairingEndpoint,
      onError: reportCurrentError,
      onPaired: () => {
        setPaired(true);
        setPairing(false);
        setScanning(false);
        showCurrent({
          label: "CONNECTED",
          tone: "success",
          content: <strong>Khie peer connected</strong>,
        });
        logCurrent("Khie peer connected", "success");
      },
      onRemotePeerChange: setRemotePeer,
      onReady: (session) => {
        setNodeReady(true);
        showCurrent({
          label: "LIBP2P NODE READY",
          tone: "success",
          content: <strong>Browser libp2p node is ready</strong>,
        });
        logCurrent("Signer node is ready", "success");
        void connectDefaultRelay(session);
      },
      onUnpaired: () => {
        setPaired(false);
        setRemotePeer(undefined);
        rejectSignerWaiters(
          signerWaiters.current,
          new Error("Khie peer disconnected"),
        );
        rejectPendingApprovals();
        showCurrent({
          label: "UNPAIRED",
          tone: "idle",
          content: <strong>Khie peer is no longer paired</strong>,
        });
        logCurrent("Khie peer unpaired");
      },
    });
    const nextSession = owner.value;
    setSession(nextSession);

    return () => {
      void owner.dispose();
    };
  }, []);

  const connectRelay = async () => {
    const address = relayAddress.trim();
    if (!session || !address) {
      return;
    }

    setRelayState("connecting");
    if (!(await session.connectRelay(address))) {
      setRelayState("failed");
      return;
    }

    setRelayState("connected");
    log(`Relay connected: ${address}`, "success");
    show({
      label: "RELAY CONNECTED",
      tone: "success",
      content: <strong>{address}</strong>,
    });
  };

  const unpair = () => session?.unpair();
  const showingPairingOverlay = pairing;
  const approvalDescription = approval
    ? formatApprovalDescription(approval)
    : undefined;

  if (paired) {
    return (
      <div className={`module-console ${styles["paired-panel"]}`}>
        <RemotePeerDetails peer={remotePeer} onUnpair={unpair} />
        <section className={styles["request-area"]}>
          {approval ? (
            <>
              <h3 className={styles["request-title"]}>
                <span>{formatApprovalTitle(approval)}</span>
                {queuedApprovalCount > 0 ? (
                  <span className={styles["request-queue"]}>
                    +{queuedApprovalCount} queued
                  </span>
                ) : null}
              </h3>
              <div className={styles["request-card"]}>
                {approval.method === "sign_transaction" ? (
                  <TransactionApprovalDetails
                    client={signer?.client ?? client}
                    transaction={approval.transaction}
                  />
                ) : approvalDescription ? (
                  <p className={styles["request-description"]}>
                    {approvalDescription}
                  </p>
                ) : null}
                <div className={`module-actions ${styles["approval-actions"]}`}>
                  <button type="button" onClick={() => resolveApproval(false)}>
                    Reject
                  </button>
                  <button
                    className="is-primary"
                    type="button"
                    onClick={() => resolveApproval(true)}
                  >
                    Approve
                  </button>
                </div>
              </div>
            </>
          ) : (
            <p className={styles["request-idle"]}>Ready for requests…</p>
          )}
        </section>
      </div>
    );
  }

  if (scanning && !showingPairingOverlay) {
    return (
      <div className="module-console">
        <div className={styles.scanner}>
          <QrScanner
            className={styles["scanner-video"]}
            onError={(cause) => {
              setScanning(false);
              reportError(cause, show, log);
            }}
            onScan={(value) => {
              const endpoint = value.trim();
              setKhieEndpoint(endpoint);
              setScanning(false);
              log("Peer session endpoint scanned", "success");
              void pairEndpoint(endpoint);
            }}
          />
          <div className={`module-actions ${styles["scanner-actions"]}`}>
            <button type="button" onClick={() => setScanning(false)}>
              Cancel scan
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="module-console">
      <div
        className="module-fields"
        aria-hidden={showingPairingOverlay}
        inert={showingPairingOverlay}
      >
        <div className={`module-field-wide ${styles["pairing-columns"]}`}>
          <div className={`module-field ${styles["pairing-group"]}`}>
            <span>To be linked</span>
            {relayConnectionFailed ? (
              <button
                className={styles["relay-retry"]}
                type="button"
                disabled={!nodeReady || connectingRelay}
                onClick={connectRelay}
              >
                {connectingRelay ? "Connecting…" : "Retry relay"}
              </button>
            ) : null}
            <div className={styles["endpoint-list"]}>
              {pairingEndpoint ? (
                <div className={styles["endpoint-pair"]}>
                  <QrCode
                    className={styles["endpoint-qr"]}
                    value={pairingEndpoint}
                    title="Signer pairing endpoint"
                  />
                  <CopyableText
                    className={styles["endpoint-copy"]}
                    value={pairingEndpoint}
                    ariaLabel="Copy signer pairing endpoint"
                    iconSize={15}
                    onError={(cause) => reportError(cause, show, log)}
                  >
                    <span>{pairingEndpoint}</span>
                  </CopyableText>
                </div>
              ) : (
                <div className={styles["endpoint-pair"]}>
                  <QrCode
                    className={styles["endpoint-qr"]}
                    title="Signer pairing endpoint"
                  />
                  <span className={styles["endpoint-pending"]}>
                    Preparing endpoint…
                  </span>
                </div>
              )}
            </div>
          </div>
          <div className={styles.divider} aria-hidden="true">
            <span>or</span>
          </div>
          <div className={`module-field ${styles["remote-column"]}`}>
            <span>To link</span>
            <div className={styles["remote-actions"]}>
              <div className={`module-actions ${styles["scan-action"]}`}>
                <button
                  className={styles["scan-button"]}
                  type="button"
                  onClick={() => setScanning(true)}
                >
                  <span className={styles["scan-icon"]}>
                    <ScanLine aria-hidden="true" size={21} strokeWidth={1.8} />
                  </span>
                  <span className={styles["scan-copy"]}>
                    <strong>Scan to Khie</strong>
                  </span>
                  <ArrowRight
                    className={styles["scan-arrow"]}
                    aria-hidden="true"
                    size={18}
                  />
                </button>
              </div>
              <div
                className={`${styles["input-action-control"]} ${styles["endpoint-control"]}`}
              >
                <input
                  value={khieEndpoint}
                  aria-label="Remote endpoint"
                  placeholder="Or paste endpoint"
                  spellCheck={false}
                  onChange={(event) =>
                    setKhieEndpoint(event.currentTarget.value)
                  }
                />
                <div className={`module-actions ${styles["inline-action"]}`}>
                  <button
                    className={styles["connect-button"]}
                    type="button"
                    disabled={!nodeReady || !khieEndpoint.trim() || pairing}
                    aria-label={pairing ? "Connecting" : "Connect"}
                    title={pairing ? "Connecting…" : "Connect"}
                    onClick={() => void pairEndpoint(khieEndpoint)}
                  >
                    <Check aria-hidden="true" size={20} strokeWidth={2} />
                  </button>
                </div>
              </div>
            </div>
          </div>
          <div className={styles["relay-controls"]}>
            <button
              className={styles["relay-settings-toggle"]}
              type="button"
              aria-expanded={advancedSettingsOpen}
              aria-controls="khie-advanced-settings"
              onClick={() => setAdvancedSettingsOpen((open) => !open)}
            >
              <span>Advanced settings</span>
              <ChevronDown
                className={styles["settings-chevron"]}
                aria-hidden="true"
                size={15}
                strokeWidth={1.8}
              />
            </button>
          </div>
          {advancedSettingsOpen ? (
            <div
              className={`module-field ${styles["relay-settings-content"]}`}
              id="khie-advanced-settings"
            >
              <span>Relay multiaddr</span>
              <div className={styles["input-action-control"]}>
                <input
                  value={relayAddress}
                  placeholder="/ip4/127.0.0.1/tcp/.../ws/p2p/..."
                  spellCheck={false}
                  onChange={(event) =>
                    setRelayAddress(event.currentTarget.value)
                  }
                />
                <div className={`module-actions ${styles["inline-action"]}`}>
                  <button
                    type="button"
                    disabled={
                      !nodeReady || !relayAddress.trim() || connectingRelay
                    }
                    onClick={connectRelay}
                  >
                    {connectingRelay
                      ? "Connecting…"
                      : relayConnected
                        ? "Reconnect"
                        : "Connect relay"}
                  </button>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </div>
      {showingPairingOverlay ? (
        <div
          className={styles["pairing-overlay"]}
          role="dialog"
          aria-modal="true"
          aria-label="Pairing with Khie"
        >
          <div className={`module-actions ${styles["pairing-dialog"]}`}>
            <p className={styles["connecting-message"]}>Pairing with Khie...</p>
            <button
              className={styles["connecting-cancel"]}
              type="button"
              onClick={() => session?.cancelPairing()}
            >
              <X aria-hidden="true" size={14} />
              <span>Cancel</span>
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function RemotePeerDetails({
  onUnpair,
  peer,
}: {
  onUnpair: () => void;
  peer?: KhieRemotePeer;
}) {
  const [now, setNow] = useState(peer?.lastRequestAt ?? 0);

  useEffect(() => {
    if (peer?.lastRequestAt === undefined) {
      return;
    }

    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [peer?.lastRequestAt]);

  const path =
    peer?.direct === undefined
      ? "Unknown path"
      : peer.direct
        ? "Direct"
        : "Relayed";
  const connectedAt = peer?.connectedAt
    ? new Date(peer.connectedAt)
    : undefined;

  return (
    <section className={styles["peer-details"]}>
      <div className={styles["peer-overview"]}>
        {peer ? (
          <div className={styles["peer-copy"]}>
            <div className={styles["peer-primary"]}>
              <span className={styles["peer-path"]} data-direct={peer.direct}>
                {path}
              </span>
              <code className={styles["peer-id"]} title={peer.id}>
                {peer.id}
              </code>
            </div>
            <span className={styles["peer-agent"]} title={peer.agentVersion}>
              {peer.agentVersion ?? "Unknown agent"}
            </span>
          </div>
        ) : (
          <p className={styles["peer-loading"]}>Loading remote peer details…</p>
        )}
        <div className={`module-actions ${styles["session-action"]}`}>
          <button type="button" onClick={onUnpair}>
            Unpair
          </button>
        </div>
      </div>

      {peer ? (
        <div className={styles["peer-times"]}>
          <div className={styles["peer-time"]}>
            <span>Connected</span>
            {connectedAt ? (
              <time dateTime={connectedAt.toISOString()}>
                {connectedAt.toLocaleString()}
              </time>
            ) : (
              <strong>Not available</strong>
            )}
          </div>
          <div className={styles["peer-time"]}>
            <span>Last request</span>
            <strong>
              {peer.lastRequestAt === undefined
                ? "No requests yet"
                : formatElapsedDuration(peer.lastRequestAt, now)}
            </strong>
          </div>
        </div>
      ) : null}
    </section>
  );
}

type TransactionCellView = {
  cellOutput?: ccc.CellOutput;
  extraCapacity?: ccc.Num;
  key: string;
  label: string;
  outputData?: string;
  reference?: string;
};

function TransactionApprovalDetails({
  client,
  transaction,
}: {
  client: ccc.Client;
  transaction: ccc.Transaction;
}) {
  const [inputResolution, setInputResolution] = useState<{
    cells: TransactionCellView[];
    client: ccc.Client;
    transaction: ccc.Transaction;
  }>();
  const [feeResolution, setFeeResolution] = useState<{
    client: ccc.Client;
    transaction: ccc.Transaction;
    value: ccc.Num | null;
  }>();
  const inputs =
    inputResolution?.client === client &&
    inputResolution.transaction === transaction
      ? inputResolution.cells
      : undefined;
  const fee =
    feeResolution?.client === client &&
    feeResolution.transaction === transaction
      ? feeResolution.value
      : undefined;

  useEffect(() => {
    let active = true;

    void Promise.all(
      transaction.inputs.map(async (input, index) => {
        const reference = `${input.previousOutput.txHash}:${input.previousOutput.index}`;
        try {
          const cell =
            input.cellOutput && input.outputData !== undefined
              ? ccc.Cell.from({
                  cellOutput: input.cellOutput,
                  outPoint: input.previousOutput,
                  outputData: input.outputData,
                })
              : await client.getCell(input.previousOutput);
          let extraCapacity: ccc.Num | undefined;
          if (cell) {
            try {
              extraCapacity = await cell.getDaoProfit(client);
            } catch {
              // Keep the cell visible; getFee independently reports availability.
            }
          }
          return {
            cellOutput: cell?.cellOutput,
            extraCapacity,
            key: reference,
            label: `${index} Input`,
            outputData: cell?.outputData,
            reference,
          };
        } catch {
          return {
            key: reference,
            label: `${index} Input`,
            reference,
          };
        }
      }),
    ).then((resolved) => {
      if (active) {
        setInputResolution({ cells: resolved, client, transaction });
      }
    });

    void transaction
      .getFee(client)
      .then((value) => {
        if (active) {
          setFeeResolution({ client, transaction, value });
        }
      })
      .catch(() => {
        if (active) {
          setFeeResolution({ client, transaction, value: null });
        }
      });

    return () => {
      active = false;
    };
  }, [client, transaction]);

  const outputs = transaction.outputs.map((cellOutput, index) => ({
    cellOutput,
    key: `output-${index}`,
    label: `${index} Output`,
    outputData: transaction.outputsData[index] ?? "0x",
  }));
  const transactionHash = transaction.hash();

  return (
    <div className={styles["transaction-details"]}>
      <div className={styles["transaction-summary"]}>
        <CopyableText
          ariaLabel="Copy transaction hash"
          className={styles["transaction-hash-copy"]}
          iconSize={10}
          value={transactionHash}
        >
          <code className={styles["transaction-hash"]} title={transactionHash}>
            {transactionHash}
          </code>
        </CopyableText>
        <span className={styles["transaction-fee"]}>
          {fee === undefined
            ? "Fee …"
            : fee === null
              ? "Fee unavailable"
              : `Fee ${ccc.fixedPointToString(fee)} CKB · ${transactionFeeRate(transaction, fee)} shannons/KB`}
        </span>
      </div>
      <TransactionCellGroup
        cells={inputs}
        client={client}
        empty="No inputs"
        title="Inputs"
      />
      <TransactionCellGroup
        cells={outputs}
        client={client}
        empty="No outputs"
        title="Outputs"
      />
    </div>
  );
}

function TransactionCellGroup({
  cells,
  client,
  empty,
  title,
}: {
  cells?: TransactionCellView[];
  client: ccc.Client;
  empty: string;
  title: string;
}) {
  const totalCapacity =
    cells?.reduce(
      (total, cell) => total + transactionCellCapacity(cell),
      ccc.Zero,
    ) ?? ccc.Zero;

  return (
    <section className={styles["transaction-cell-group"]}>
      <div className={styles["transaction-cell-heading"]}>
        <strong>{title}</strong>
        <span>{cells?.length ?? "…"}</span>
      </div>
      <div className={styles["transaction-cell-list"]}>
        {cells === undefined ? (
          <p className={styles["transaction-cell-status"]}>Loading cells…</p>
        ) : cells.length === 0 ? (
          <p className={styles["transaction-cell-status"]}>{empty}</p>
        ) : (
          cells.map((cell) => (
            <TransactionCellItem
              cell={cell}
              client={client}
              key={cell.key}
              totalCapacity={totalCapacity}
            />
          ))
        )}
      </div>
    </section>
  );
}

function TransactionCellItem({
  cell,
  client,
  totalCapacity,
}: {
  cell: TransactionCellView;
  client: ccc.Client;
  totalCapacity: bigint;
}) {
  const { cellOutput } = cell;
  const capacity = transactionCellCapacity(cell);
  const capacityShare =
    cellOutput && totalCapacity > ccc.Zero
      ? Number((capacity * ccc.numFrom(1000)) / totalCapacity) / 10
      : 0;
  const style = {
    "--capacity-share": `${capacityShare}%`,
  } as CSSProperties;

  if (!cellOutput) {
    return (
      <div className={styles["transaction-cell-unavailable"]}>
        <strong>{cell.label}</strong>
        <span>Cell details unavailable</span>
      </div>
    );
  }

  const lockAddress = ccc.Address.fromScript(
    cellOutput.lock,
    client,
  ).toString();

  return (
    <details className={styles["transaction-cell"]} style={style}>
      <summary>
        <span className={styles["transaction-cell-summary"]}>
          <span className={styles["transaction-cell-identity"]}>
            <small>{cell.label}</small>
            <code title={lockAddress}>{lockAddress}</code>
          </span>
          <strong className={styles["transaction-cell-capacity"]}>
            {cell.extraCapacity && cell.extraCapacity > ccc.Zero
              ? `${ccc.fixedPointToString(cellOutput.capacity)} + ${ccc.fixedPointToString(cell.extraCapacity)} CKB`
              : `${ccc.fixedPointToString(cellOutput.capacity)} CKB`}
          </strong>
        </span>
        <ChevronDown aria-hidden="true" size={15} />
      </summary>
      <div className={styles["transaction-cell-expanded"]}>
        {cell.reference ? (
          <TransactionCellField
            copyable
            label="Outpoint"
            value={cell.reference}
          />
        ) : null}
        <TransactionScriptDetails
          address={lockAddress}
          label="Lock script"
          script={cellOutput.lock}
        />
        <TransactionScriptDetails
          label="Type script"
          script={cellOutput.type}
        />
        <TransactionCellField
          label="Data"
          multiline
          value={cell.outputData ?? "0x"}
        />
      </div>
    </details>
  );
}

function TransactionScriptDetails({
  address,
  label,
  script,
}: {
  address?: string;
  label: string;
  script?: ccc.Script;
}) {
  if (!script) {
    return <TransactionCellField label={label} value="None" />;
  }

  return (
    <div className={styles["transaction-script"]}>
      <div className={styles["transaction-script-heading"]}>
        <span>{label}</span>
        {address ? (
          <CopyableText
            ariaLabel="Copy lock address"
            className={styles["transaction-script-address"]}
            iconSize={9}
            value={address}
          >
            <code>{address}</code>
          </CopyableText>
        ) : null}
      </div>
      <TransactionCellField
        copyable
        label="Code hash"
        value={script.codeHash}
      />
      <TransactionCellField label="Hash type" value={script.hashType} />
      <TransactionCellField copyable label="Args" value={script.args} />
    </div>
  );
}

function TransactionCellField({
  copyable = false,
  label,
  multiline = false,
  value,
}: {
  copyable?: boolean;
  label: string;
  multiline?: boolean;
  value: string;
}) {
  return (
    <div
      className={styles["transaction-cell-field"]}
      data-multiline={multiline || undefined}
    >
      <span>{label}</span>
      {copyable ? (
        <CopyableText
          ariaLabel={`Copy ${label}`}
          className={styles["transaction-cell-copy"]}
          iconSize={10}
          value={value}
        >
          <code>{value}</code>
        </CopyableText>
      ) : (
        <code title={value}>{value}</code>
      )}
    </div>
  );
}

function transactionCellCapacity(cell: TransactionCellView) {
  return (
    (cell.cellOutput?.capacity ?? ccc.Zero) + (cell.extraCapacity ?? ccc.Zero)
  );
}

function transactionFeeRate(transaction: ccc.Transaction, fee: ccc.Num) {
  return (
    (fee * ccc.numFrom(1000)) / ccc.numFrom(transaction.toBytes().length + 4)
  );
}

function formatElapsedDuration(timestamp: number, now: number) {
  const seconds = Math.max(0, Math.floor((now - timestamp) / 1000));
  if (seconds < 60) {
    return seconds === 0
      ? "Just now"
      : `${seconds} second${seconds === 1 ? "" : "s"} ago`;
  }

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) {
    return `${minutes} minute${minutes === 1 ? "" : "s"} ago`;
  }

  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  }

  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

function clientForNetworkId(networkId: string, current: ccc.Client) {
  if (networkIdFromAddressPrefix(current.addressPrefix) === networkId) {
    return current;
  }

  if (networkId === "ckb-mainnet") {
    return new ccc.ClientPublicMainnet();
  }
  if (networkId === "ckb-testnet") {
    return new ccc.ClientPublicTestnet();
  }

  throw new ccc.JsonRpcError({
    code: -32001,
    message: `Unsupported network ID: ${networkId}`,
  });
}

function formatApprovalDescription(approval: ccc.SignerJsonRpcConfirmation) {
  switch (approval.method) {
    case "connect":
      return `Switch to network ${approval.networkId}`;
    case "sign_message":
      return approval.message.value;
    case "sign_transaction":
      return `Transaction ${approval.transaction.hash()}`;
  }
}

function formatApprovalTitle(approval: ccc.SignerJsonRpcConfirmation) {
  return formatRequestTitle(approval.method);
}

function formatRequestTitle(method: string) {
  switch (method) {
    case "connect":
      return "Connect";
    case "sign_message":
      return "Sign Message";
    case "sign_transaction":
      return "Sign Transaction";
    default:
      return method;
  }
}

function formatRequestCompletion(method: string) {
  switch (method) {
    case "connect":
      return "Signer connected";
    case "sign_message":
      return "Message signed";
    case "sign_transaction":
      return "Transaction signed";
  }
}

// TODO: In the next major version, read the network ID directly from Client
// instead of inferring it from addressPrefix.
function networkIdFromAddressPrefix(addressPrefix: string) {
  if (addressPrefix === "ckb") {
    return "ckb-mainnet";
  }
  if (addressPrefix === "ckt") {
    return "ckb-testnet";
  }

  throw new ccc.JsonRpcError({
    code: -32001,
    message: `Unsupported address prefix: ${addressPrefix}`,
  });
}

function resolveSignerWaiters(
  signer: ccc.Signer | undefined,
  waiters: Set<SignerWaiter>,
) {
  if (!signer) {
    return;
  }

  waiters.forEach((waiter) => {
    if (
      waiter.networkId !==
      networkIdFromAddressPrefix(signer.client.addressPrefix)
    ) {
      return;
    }

    waiters.delete(waiter);
    waiter.signal.removeEventListener("abort", waiter.abort);
    waiter.resolve(signer);
  });
}

function rejectSignerWaiters(waiters: Set<SignerWaiter>, cause: Error) {
  waiters.forEach((waiter) => {
    waiter.signal.removeEventListener("abort", waiter.abort);
    waiter.reject(cause);
  });
  waiters.clear();
}

function abortReason(signal: AbortSignal) {
  if (signal.reason instanceof Error) {
    return signal.reason;
  }

  const error = new Error("JSON-RPC request canceled");
  error.name = "AbortError";
  return error;
}

function requestTimeoutError() {
  const error = new Error("JSON-RPC request timed out");
  error.name = "TimeoutError";
  return error;
}

function isTimeoutError(cause: unknown): cause is Error {
  return cause instanceof Error && cause.name === "TimeoutError";
}

function reportError(
  cause: unknown,
  show: ModuleRuntimeProps["show"],
  log: ModuleRuntimeProps["log"],
) {
  const message =
    cause instanceof Error ? cause.message : "libp2p operation failed";

  show({
    label: "LIBP2P FAULT",
    tone: "error",
    content: <strong>{message}</strong>,
  });
  log(message, "error");
}
