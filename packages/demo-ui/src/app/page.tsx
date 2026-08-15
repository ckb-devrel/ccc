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
  Zap,
} from "lucide-react";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";

const tools = [
  { name: "Transfer CKB", group: "Transaction", icon: Send },
  { name: "Nervos DAO", group: "Transaction", icon: Vault },
  { name: "Sign message", group: "Transaction", icon: Fingerprint },
  { name: "Time lock", group: "Transaction", icon: LockKeyhole },
  { name: "Issue xUDT", group: "Assets", icon: CircleDollarSign },
  { name: "Transfer xUDT", group: "Assets", icon: ArrowDownToLine },
  { name: "Mint Spore", group: "Assets", icon: Sparkles },
  { name: "Spore cluster", group: "Assets", icon: Shapes },
  { name: "Deploy script", group: "Developer", icon: Cpu },
  { name: "SSRI", group: "Developer", icon: Braces },
  { name: "Hash utilities", group: "Utilities", icon: Hash },
  { name: "Mnemonic", group: "Utilities", icon: KeyRound },
];

type Telemetry = {
  addresses: string[];
  balance: string;
};

export default function Home() {
  const { client, disconnect, open, signerInfo, wallet } = ccc.useCcc();
  const signer = signerInfo?.signer;
  const [selectedTool, setSelectedTool] = useState("Transfer CKB");
  const [telemetry, setTelemetry] = useState<Telemetry>();
  const connected = signer !== undefined;

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
          <span>{connected ? "SESSION ACTIVE" : "AWAITING LINK"}</span>
        </div>
      </header>

      <section className={`machine ${connected ? "is-connected" : ""}`}>
        <div className="machine-heading">
          <div>
            <span className="section-index">01 / ACCESS</span>
            <h1>{connected ? "Connection established" : "Connect to begin"}</h1>
          </div>
        </div>

        <div className="panel-viewport">
          <section
            className="machine-panel connection-panel"
            aria-hidden={connected}
          >
            <PanelHardware code="LINK/00" />
            <div className="connection-copy">
              <span className="panel-kicker">
                <Link2 size={14} /> Connection interface
              </span>
              <h2>Select an access method</h2>
              <p>
                Establish a secure link to reveal account telemetry and the
                complete tool assembly.
              </p>
            </div>

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

              <button type="button" className="connection-option" disabled>
                <span className="option-icon">
                  <KeyRound size={22} />
                </span>
                <span className="option-copy">
                  <small>Coming next</small>
                  <strong>Private key</strong>
                </span>
                <ChevronRight className="option-arrow" size={18} />
              </button>
            </div>
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
                <div className="wallet-icon-stage">
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
                </div>
                <button
                  type="button"
                  className="wallet-open-control"
                  onClick={open}
                >
                  Open wallet
                </button>
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

        <section className="tool-bay" aria-hidden={!connected}>
          <div className="bay-rail bay-rail-left" aria-hidden="true" />
          <div className="bay-rail bay-rail-right" aria-hidden="true" />

          <div className="tool-bay-header">
            <div>
              <span className="section-index">02 / TOOL ARRAY</span>
              <h2>Select an operation</h2>
            </div>
            <div className="bay-status">
              <Activity size={14} />
              <span>12 MODULES READY</span>
            </div>
          </div>

          <div className="tool-grid">
            {tools.map(({ name, group, icon: ToolIcon }, index) => {
              const selected = selectedTool === name;
              return (
                <button
                  key={name}
                  type="button"
                  className={`tool-module ${selected ? "is-selected" : ""}`}
                  style={{ "--module-index": index } as React.CSSProperties}
                  onClick={() => setSelectedTool(name)}
                >
                  <span className="module-index">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <span className="module-icon">
                    <ToolIcon size={19} />
                  </span>
                  <span className="module-copy">
                    <small>{group}</small>
                    <strong>{name}</strong>
                  </span>
                  <span className="module-state">
                    {selected ? (
                      <Check size={14} />
                    ) : (
                      <ChevronRight size={14} />
                    )}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="command-dock">
            <div className="dock-grip" aria-hidden="true">
              <span />
              <span />
              <span />
            </div>
            <div className="dock-selection">
              <small>MODULE SELECTED</small>
              <strong>{selectedTool}</strong>
            </div>
            <div className="dock-checks">
              <span>
                <Check size={12} /> Network
              </span>
              <span>
                <Check size={12} /> Signer
              </span>
            </div>
            <button type="button" className="engage-button">
              Engage module
              <Zap size={16} />
            </button>
          </div>
        </section>
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
