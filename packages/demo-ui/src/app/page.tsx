"use client";

import { ccc } from "@ckb-ccc/connector-react";
import {
  Activity,
  ArrowDownToLine,
  ArrowRight,
  Box,
  Braces,
  Check,
  ChevronRight,
  CircleDollarSign,
  Cpu,
  Database,
  Fingerprint,
  Hash,
  KeyRound,
  Link2,
  LockKeyhole,
  Pickaxe,
  Send,
  Shapes,
  ShieldCheck,
  Sparkles,
  Unplug,
  Vault,
  WalletCards,
  Wrench,
} from "lucide-react";
import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";

const tools = [
  {
    name: "Transfer CKB",
    group: "Transaction",
    icon: Send,
    requiresSigner: true,
  },
  {
    name: "Nervos DAO",
    group: "Transaction",
    icon: Vault,
    requiresSigner: true,
  },
  {
    name: "Sign message",
    group: "Transaction",
    icon: Fingerprint,
    requiresSigner: true,
  },
  {
    name: "Time lock",
    group: "Transaction",
    icon: LockKeyhole,
    requiresSigner: true,
  },
  {
    name: "Issue xUDT",
    group: "Assets",
    icon: CircleDollarSign,
    requiresSigner: true,
  },
  {
    name: "Transfer xUDT",
    group: "Assets",
    icon: ArrowDownToLine,
    requiresSigner: true,
  },
  { name: "Mint Spore", group: "Assets", icon: Sparkles, requiresSigner: true },
  {
    name: "Spore cluster",
    group: "Assets",
    icon: Shapes,
    requiresSigner: true,
  },
  {
    name: "Deploy script",
    group: "Developer",
    icon: Cpu,
    requiresSigner: true,
  },
  { name: "SSRI", group: "Developer", icon: Braces, requiresSigner: true },
  {
    name: "Hash utilities",
    group: "Utilities",
    icon: Hash,
    requiresSigner: false,
  },
  {
    name: "Mnemonic",
    group: "Utilities",
    icon: KeyRound,
    requiresSigner: false,
  },
];

type Telemetry = {
  addresses: string[];
  balance: string;
};

export default function Home() {
  const {
    client,
    disconnect: disconnectWallet,
    open,
    signerInfo,
    wallet,
  } = ccc.useCcc();
  const [privateKeySigner, setPrivateKeySigner] = useState<
    ccc.SignerCkbPrivateKey | undefined
  >();
  const [privateKeyMode, setPrivateKeyMode] = useState(false);
  const [privateKey, setPrivateKey] = useState("");
  const [privateKeyError, setPrivateKeyError] = useState<string>();
  const [selectedTool, setSelectedTool] = useState<string>();
  const [telemetry, setTelemetry] = useState<Telemetry>();
  const signer = useMemo(() => {
    if (!privateKeySigner) {
      return signerInfo?.signer;
    }

    if (privateKeySigner.client.addressPrefix === client.addressPrefix) {
      return privateKeySigner;
    }

    return new ccc.SignerCkbPrivateKey(client, privateKeySigner.privateKey);
  }, [client, privateKeySigner, signerInfo]);
  const connected = signer !== undefined;
  const usingPrivateKey = privateKeySigner !== undefined;
  const selectedModule = tools.find(({ name }) => name === selectedTool);
  const needsAccess = selectedModule?.requiresSigner === true;

  const disconnect = () => {
    setTelemetry(undefined);
    if (privateKeySigner) {
      setPrivateKeySigner(undefined);
      return;
    }
    disconnectWallet();
  };

  const connectPrivateKey = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    try {
      const nextSigner = new ccc.SignerCkbPrivateKey(client, privateKey.trim());
      setTelemetry(undefined);
      setPrivateKeySigner(nextSigner);
      setPrivateKey("");
      setPrivateKeyError(undefined);
      setPrivateKeyMode(false);
    } catch {
      setPrivateKeyError("Invalid private key");
    }
  };

  useEffect(() => {
    if (!signer) {
      return;
    }

    let cancelled = false;
    Promise.all([signer.getAddresses(), signer.getBalance()])
      .then(([addresses, balance]) => {
        if (cancelled) {
          return;
        }
        setTelemetry({
          addresses,
          balance: ccc.fixedPointToString(
            balance / ccc.fixedPointFrom("1", 6),
            2,
          ),
        });
      })
      .catch(() => {
        if (!cancelled) {
          setTelemetry({
            addresses: [],
            balance: "Unavailable",
          });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [signer]);

  return (
    <main className="demo-shell">
      <header className="topbar">
        <div className="brand-lockup">
          <span className="brand-mark">
            <Image src="/logo.svg" alt="CCC" width={24} height={24} priority />
          </span>
          <span className="brand-copy">
            <strong>CCC</strong>
            <small>Precision toolkit</small>
          </span>
        </div>

        <div className="system-readout" aria-label="Prototype status">
          <span className="signal-light" />
          <span>UI PROTOTYPE</span>
          <span className="readout-divider" />
          <span>
            {connected
              ? "SESSION ACTIVE"
              : needsAccess
                ? "AWAITING LINK"
                : selectedTool
                  ? "LOCAL MODULE READY"
                  : "AWAITING COMMAND"}
          </span>
        </div>
      </header>

      <section
        className={`machine ${selectedTool ? "has-selection" : ""} ${needsAccess ? "needs-access" : ""} ${connected ? "is-connected" : ""}`}
      >
        <ToolBay
          connected={connected}
          selectedTool={selectedTool}
          onSelect={setSelectedTool}
          onClear={() => {
            setPrivateKey("");
            setPrivateKeyError(undefined);
            setPrivateKeyMode(false);
            setSelectedTool(undefined);
          }}
        />

        <div className="machine-heading access-heading">
          <div>
            <span className="section-index">02 / ACCESS</span>
            <h1>
              {connected ? "Connection established" : "Connect to continue"}
            </h1>
          </div>
        </div>

        <div className="panel-viewport" aria-hidden={!needsAccess}>
          <section
            className="machine-panel connection-panel"
            aria-hidden={connected}
          >
            <PanelHardware code={privateKeyMode ? "KEY/01" : "LINK/00"} />
            <div className="connection-copy">
              <span className="panel-kicker">
                {privateKeyMode ? <KeyRound size={14} /> : <Link2 size={14} />}
                {privateKeyMode ? "Local signer" : "Connection interface"}
              </span>
              <h2>
                {privateKeyMode
                  ? "Enter your private key"
                  : "Select an access method"}
              </h2>
              <p>
                {privateKeyMode
                  ? "The key stays in this browser session and is never persisted by this demo."
                  : "Establish a secure link to reveal account telemetry and the complete tool assembly."}
              </p>
            </div>

            {privateKeyMode ? (
              <form className="private-key-form" onSubmit={connectPrivateKey}>
                <label className="private-key-field">
                  <span>Private key</span>
                  <span className="private-key-input-frame">
                    <KeyRound size={16} aria-hidden="true" />
                    <input
                      autoFocus
                      type="password"
                      value={privateKey}
                      placeholder="0x0123456789…"
                      autoComplete="new-password"
                      spellCheck={false}
                      onChange={(event) => {
                        setPrivateKey(event.currentTarget.value);
                        setPrivateKeyError(undefined);
                      }}
                    />
                  </span>
                </label>
                <span className="private-key-message" aria-live="polite">
                  {privateKeyError ?? "32-byte CKB secp256k1 key"}
                </span>
                <div className="private-key-actions">
                  <button
                    type="button"
                    onClick={() => {
                      setPrivateKey("");
                      setPrivateKeyError(undefined);
                      setPrivateKeyMode(false);
                    }}
                  >
                    Back
                  </button>
                  <button
                    type="submit"
                    className="is-primary"
                    disabled={privateKey.trim().length === 0}
                  >
                    Establish link
                  </button>
                </div>
              </form>
            ) : (
              <div className="connection-options">
                <button
                  type="button"
                  className="connection-option option-primary"
                  onClick={open}
                >
                  <span className="option-icon">
                    <WalletCards size={23} />
                  </span>
                  <span className="option-copy">
                    <small>Recommended</small>
                    <strong>Connect wallet</strong>
                  </span>
                  <ArrowRight className="option-arrow" size={18} />
                </button>

                <button
                  type="button"
                  className="connection-option"
                  onClick={() => setPrivateKeyMode(true)}
                >
                  <span className="option-icon">
                    <KeyRound size={22} />
                  </span>
                  <span className="option-copy">
                    <small>Local signer</small>
                    <strong>Private key</strong>
                  </span>
                  <ChevronRight className="option-arrow" size={18} />
                </button>
              </div>
            )}
          </section>

          <section
            className="machine-panel account-panel"
            aria-hidden={!connected}
          >
            <PanelHardware code="LINK/01" />
            <div className="account-backplane" aria-hidden="true">
              <span className="backplane-vent vent-left" />
              <span className="backplane-vent vent-right" />
            </div>
            <div className="account-primary">
              <div className="wallet-control">
                {usingPrivateKey ? (
                  <div className="wallet-icon-stage">
                    <div className="connection-seal">
                      <span className="seal-pulse" />
                      <KeyRound size={25} />
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    className="wallet-icon-stage"
                    aria-label="Open wallet"
                    onClick={open}
                  >
                    <div className="connection-seal">
                      <span className="seal-pulse" />
                      {wallet?.icon ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          className="connected-wallet-icon"
                          src={wallet.icon}
                          alt={wallet.name}
                        />
                      ) : (
                        <ShieldCheck size={25} />
                      )}
                    </div>
                  </button>
                )}
                {usingPrivateKey ? (
                  <div className="wallet-signer-label">Local key</div>
                ) : (
                  <button
                    type="button"
                    className="wallet-open-control"
                    onClick={open}
                  >
                    Open wallet
                  </button>
                )}
                <button
                  type="button"
                  className="wallet-disconnect-control"
                  onClick={disconnect}
                >
                  Disconnect
                </button>
              </div>
              <div className="address-column">
                <div className="address-stack">
                  <AddressList
                    key={telemetry?.addresses.join("|") ?? "loading"}
                    addresses={telemetry?.addresses}
                  />
                </div>
                <div className="account-balance">
                  <span>Balance</span>
                  <strong>
                    {telemetry ? `${telemetry.balance} CKB` : "Loading…"}
                  </strong>
                </div>
              </div>
            </div>
          </section>
        </div>
      </section>

      <footer className="footer-readout">
        <span>
          <Database size={13} /> CKB{" "}
          {client.addressPrefix === "ckb" ? "MAINNET" : "TESTNET"}
        </span>
        <span>
          <Box size={13} /> CCC / UI-LAB / 0.1
        </span>
        <span>
          <Wrench size={13} /> WALLET LINK ACTIVE
        </span>
        <span className="footer-spacer" />
        <span>
          <Pickaxe size={13} /> SYSTEM NOMINAL
        </span>
        <span>
          <Unplug size={13} /> {connected ? "CONNECTED" : "DISCONNECTED"}
        </span>
      </footer>
    </main>
  );
}

function ToolBay({
  connected,
  onClear,
  onSelect,
  selectedTool,
}: {
  connected: boolean;
  onClear: () => void;
  onSelect: (tool: string) => void;
  selectedTool?: string;
}) {
  const selectedModule = tools.find(({ name }) => name === selectedTool);

  return (
    <section className="tool-bay">
      <div className="bay-rail bay-rail-left" aria-hidden="true" />
      <div className="bay-rail bay-rail-right" aria-hidden="true" />

      <div className="tool-bay-header">
        <div>
          <span className="section-index">01 / TOOL ARRAY</span>
          <h2>
            {selectedTool ? "Operation selected" : "What do you want to do?"}
          </h2>
        </div>
        <div className="bay-status">
          <Activity size={14} />
          <span>12 MODULES READY</span>
        </div>
      </div>

      <div className="tool-grid" aria-hidden={selectedTool !== undefined}>
        {tools.map(({ name, group, icon: ToolIcon, requiresSigner }, index) => {
          const selected = selectedTool === name;
          return (
            <button
              key={name}
              type="button"
              disabled={selectedTool !== undefined}
              className={`tool-module ${selected ? "is-selected" : ""}`}
              style={{ "--module-index": index } as React.CSSProperties}
              onClick={() => onSelect(name)}
            >
              <span className="module-index">
                {String(index + 1).padStart(2, "0")}
              </span>
              <span
                className={`module-icon ${requiresSigner ? "requires-signer" : "is-local"}`}
              >
                <ToolIcon size={19} />
              </span>
              <span className="module-copy">
                <small>{group}</small>
                <strong>{name}</strong>
              </span>
              <span className="module-state">
                {selected ? <Check size={14} /> : <ChevronRight size={14} />}
              </span>
            </button>
          );
        })}
      </div>

      <button
        type="button"
        className={`command-dock ${selectedTool ? "is-mounted" : ""}`}
        disabled={!selectedTool}
        aria-label={selectedTool ? "Change operation" : "Select an operation"}
        onClick={onClear}
      >
        <span className="dock-grip" aria-hidden="true">
          <span />
          <span />
          <span />
        </span>
        <span className="dock-selection">
          <small>{selectedTool ? "CHANGE OPERATION" : "SELECT A MODULE"}</small>
          <strong>{selectedTool ?? "No operation selected"}</strong>
          <span className="dock-checks">
            <span className={selectedTool ? "is-ready" : ""}>
              <Check size={12} /> {selectedTool ? "Mounted" : "Slot empty"}
            </span>
            <span
              className={
                selectedModule?.requiresSigner === false || connected
                  ? "is-ready"
                  : ""
              }
            >
              <Check size={12} />
              {selectedModule?.requiresSigner === false ? "Local" : "Signer"}
            </span>
          </span>
        </span>
      </button>
    </section>
  );
}

function AddressList({ addresses }: { addresses?: string[] }) {
  const listRef = useRef<HTMLDivElement>(null);
  const copyTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const addressCount = addresses?.length ?? 0;
  const [activeIndex, setActiveIndex] = useState(0);
  const [copiedIndex, setCopiedIndex] = useState<number>();

  useEffect(
    () => () => {
      clearTimeout(copyTimerRef.current);
    },
    [],
  );

  useEffect(() => {
    const list = listRef.current;
    if (!list || addressCount < 2) {
      return;
    }

    let gestureLocked = false;
    let unlockTimer: ReturnType<typeof setTimeout> | undefined;
    const unlockAfterGesture = () => {
      clearTimeout(unlockTimer);
      unlockTimer = setTimeout(() => {
        gestureLocked = false;
      }, 180);
    };

    const handleWheel = (event: WheelEvent) => {
      if (event.deltaY === 0) {
        return;
      }

      if (gestureLocked) {
        event.preventDefault();
        unlockAfterGesture();
        return;
      }

      const currentIndex = Math.round(list.scrollTop / 42);
      const nextIndex = Math.max(
        0,
        Math.min(addressCount - 1, currentIndex + Math.sign(event.deltaY)),
      );

      if (nextIndex === currentIndex) {
        return;
      }

      event.preventDefault();
      gestureLocked = true;
      setActiveIndex(nextIndex);
      list.scrollTo({ top: nextIndex * 42, behavior: "smooth" });
      unlockAfterGesture();
    };

    list.addEventListener("wheel", handleWheel, { passive: false });
    return () => {
      clearTimeout(unlockTimer);
      list.removeEventListener("wheel", handleWheel);
    };
  }, [addressCount]);

  return (
    <div
      ref={listRef}
      className="address-list"
      aria-label="Wallet addresses"
      onScroll={(event) => {
        setActiveIndex(Math.round(event.currentTarget.scrollTop / 42));
      }}
    >
      {!addresses ? (
        <div className="address-row is-loading">Reading signer…</div>
      ) : addresses.length === 0 ? (
        <div className="address-row is-loading">No address available</div>
      ) : (
        addresses.map((address, index) => (
          <button
            type="button"
            className={`address-row ${
              index === activeIndex
                ? "is-active"
                : Math.abs(index - activeIndex) === 1
                  ? "is-adjacent"
                  : ""
            } ${copiedIndex === index ? "is-copied" : ""}`}
            title={address}
            aria-label={
              index === activeIndex
                ? `Copy address ${address}`
                : `Scroll to address ${address}`
            }
            key={`${address}-${index}`}
            onClick={() => {
              if (index !== activeIndex) {
                setActiveIndex(index);
                listRef.current?.scrollTo({
                  top: index * 42,
                  behavior: "smooth",
                });
                return;
              }

              void window.navigator.clipboard.writeText(address).then(() => {
                clearTimeout(copyTimerRef.current);
                setCopiedIndex(index);
                copyTimerRef.current = setTimeout(() => {
                  setCopiedIndex(undefined);
                }, 900);
              });
            }}
          >
            <span className="address-value address-value-wide">
              {shortenAddress(address, 12)}
            </span>
            <span className="address-value address-value-compact">
              {shortenAddress(address, 7)}
            </span>
          </button>
        ))
      )}
    </div>
  );
}

function shortenAddress(address: string, sideLength: number) {
  if (address.length <= sideLength * 2 + 1) {
    return address;
  }
  return `${address.slice(0, sideLength)}…${address.slice(-sideLength)}`;
}

function PanelHardware({ code }: { code: string }) {
  return (
    <div className="panel-hardware" aria-hidden="true">
      <span className="hardware-code">{code}</span>
      <span className="hardware-line" />
      <span className="fastener" />
    </div>
  );
}
