"use client";

import { ccc } from "@ckb-ccc/connector-react";
import {
  ArrowRight,
  ChevronRight,
  Database,
  Eye,
  EyeOff,
  KeyRound,
  Link2,
  ShieldCheck,
  WalletCards,
} from "lucide-react";
import Image from "next/image";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import logoText from "../../../../assets/logoText.svg";
import { ActivityConsole, useActivityLog } from "./activity-console";
import { CopyableText } from "./copyable-text";
import { explorerLink } from "./explorer-link";
import { HeaderLinks } from "./header-links";
import { ModuleWorkspace } from "./module-workspace";
import { demoModules, type DemoModule } from "./modules";
import { QrCode } from "./qr-code";
import { ToolBay } from "./tool-bay";

type Telemetry = {
  addresses: string[];
  balance: string;
};

const BODY_BACKGROUND_PARALLAX = 0.2;

function setModuleAnchor(id?: DemoModule["id"]) {
  const url = new URL(window.location.href);
  url.hash = id ?? "";
  window.history.replaceState(window.history.state, "", url);
}

export default function Home() {
  const { log, store: activityLog } = useActivityLog();
  const {
    client,
    disconnect: disconnectWallet,
    open,
    setClient,
    signerInfo,
    wallet,
  } = ccc.useCcc();
  const [privateKeySigner, setPrivateKeySigner] = useState<
    ccc.SignerCkbPrivateKey | undefined
  >();
  const [privateKeyMode, setPrivateKeyMode] = useState(false);
  const [privateKey, setPrivateKey] = useState("");
  const [privateKeyVisible, setPrivateKeyVisible] = useState(false);
  const [privateKeyError, setPrivateKeyError] = useState<string>();
  const [selectedModule, setSelectedModule] = useState<DemoModule>();
  const [stagedModule, setStagedModule] = useState<DemoModule>();
  const [workspaceVisible, setWorkspaceVisible] = useState(false);
  const [telemetry, setTelemetry] = useState<Telemetry>();
  const [activeAddress, setActiveAddress] = useState<string>();
  const previousNetworkRef = useRef(client.addressPrefix);
  const previousSelectedModuleRef = useRef<DemoModule | undefined>(undefined);
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
  const needsAccess = selectedModule?.access === "signer";
  const workspaceReady =
    selectedModule !== undefined && (!needsAccess || connected);

  useEffect(() => {
    const selectModuleFromAnchor = () => {
      const id = window.location.hash.slice(1);
      setSelectedModule(demoModules.find((module) => module.id === id));
    };

    selectModuleFromAnchor();
    window.addEventListener("hashchange", selectModuleFromAnchor);
    window.addEventListener("popstate", selectModuleFromAnchor);
    return () => {
      window.removeEventListener("hashchange", selectModuleFromAnchor);
      window.removeEventListener("popstate", selectModuleFromAnchor);
    };
  }, []);

  useEffect(() => {
    const previous = previousSelectedModuleRef.current;
    if (previous?.id === selectedModule?.id) {
      return;
    }

    if (previous) {
      log("SYSTEM", `${previous.name} module ejected`);
    }
    if (selectedModule) {
      log("SYSTEM", `${selectedModule.name} module mounted`);
    }
    previousSelectedModuleRef.current = selectedModule;
  }, [log, selectedModule]);

  useLayoutEffect(() => {
    document.body.classList.toggle("has-active-workspace", workspaceReady);
  }, [workspaceReady]);

  useEffect(() => {
    let stageFrame = 0;
    let releaseTimer: ReturnType<typeof setTimeout> | undefined;

    stageFrame = requestAnimationFrame(() => {
      setWorkspaceVisible(false);
      if (selectedModule) {
        setStagedModule(selectedModule);
      } else {
        releaseTimer = setTimeout(() => setStagedModule(undefined), 720);
      }
    });

    return () => {
      cancelAnimationFrame(stageFrame);
      clearTimeout(releaseTimer);
    };
  }, [selectedModule]);

  useEffect(() => {
    const activeFrame = requestAnimationFrame(() => {
      setWorkspaceVisible(
        workspaceReady && stagedModule?.id === selectedModule?.id,
      );
    });

    return () => cancelAnimationFrame(activeFrame);
  }, [selectedModule, stagedModule, workspaceReady]);

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
      setPrivateKeyVisible(false);
      setPrivateKeyError(undefined);
      setPrivateKeyMode(false);
    } catch {
      setPrivateKeyError("Invalid private key");
    }
  };

  const generatePrivateKey = () => {
    for (;;) {
      const generated = ccc.hexFrom(
        window.crypto.getRandomValues(new Uint8Array(32)),
      );

      try {
        new ccc.SignerCkbPrivateKey(client, generated);
        setPrivateKey(generated);
        setPrivateKeyError(undefined);
        return;
      } catch {
        // Retry the vanishingly unlikely invalid secp256k1 scalar.
      }
    }
  };

  const switchNetwork = () => {
    const nextIsMainnet = client.addressPrefix !== "ckb";
    setTelemetry(undefined);
    setClient(
      nextIsMainnet
        ? new ccc.ClientPublicMainnet()
        : new ccc.ClientPublicTestnet(),
    );
  };

  useEffect(() => {
    if (previousNetworkRef.current === client.addressPrefix) {
      return;
    }

    previousNetworkRef.current = client.addressPrefix;
    setTelemetry(undefined);
    log(
      "SYSTEM",
      `Network switched to CKB ${client.addressPrefix === "ckb" ? "MAINNET" : "TESTNET"}`,
    );
  }, [client.addressPrefix, log]);

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
        setActiveAddress(addresses[0]);
      })
      .catch(() => {
        if (!cancelled) {
          setTelemetry({
            addresses: [],
            balance: "Unavailable",
          });
          setActiveAddress(undefined);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [signer]);

  useEffect(() => {
    const syncBackgroundPosition = () => {
      document.body.style.setProperty(
        "--page-scroll-y",
        `${-window.scrollY * BODY_BACKGROUND_PARALLAX}px`,
      );
    };

    syncBackgroundPosition();
    window.addEventListener("scroll", syncBackgroundPosition, {
      passive: true,
    });

    return () => {
      window.removeEventListener("scroll", syncBackgroundPosition);
      document.body.style.removeProperty("--page-scroll-y");
      document.body.classList.remove("has-active-workspace");
    };
  }, []);

  const selectModule = useCallback((module: DemoModule) => {
    setSelectedModule(module);
    setModuleAnchor(module.id);
  }, []);

  const clearModule = useCallback(() => {
    setPrivateKey("");
    setPrivateKeyError(undefined);
    setPrivateKeyMode(false);
    setSelectedModule(undefined);
    setModuleAnchor();
  }, []);

  return (
    <>
      <div
        className="background-projection page-background"
        aria-hidden="true"
      />
      <div
        className="background-projection footer-background"
        aria-hidden="true"
      />

      <main className="demo-shell">
        <header className="topbar">
          {/* A native link intentionally resets this single-page demo. */}
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
          <a className="brand-lockup" href="/" aria-label="CCC home">
            <span className="brand-mark">
              <Image
                src="/logo.svg"
                alt="CCC"
                width={24}
                height={24}
                priority
              />
            </span>
            <Image
              className="brand-wordmark"
              src={logoText}
              alt="CCC"
              width={45}
              height={20}
            />
          </a>

          <HeaderLinks client={client} />
        </header>

        <section
          className={`machine ${selectedModule ? "has-selection" : ""} ${needsAccess ? "needs-access" : ""} ${connected ? "is-connected" : ""}`}
        >
          <ToolBay
            connected={connected}
            selectedModule={selectedModule}
            onSelect={selectModule}
            onClear={clearModule}
          />

          <ModuleWorkspace
            active={workspaceVisible}
            client={client}
            log={log}
            module={stagedModule}
            signer={signer}
          />

          <div className="machine-heading access-heading">
            <div>
              <span className="section-index">
                <span className="section-glyph" aria-hidden="true">
                  {connected ? "肆" : "貳"}
                </span>
                <span className="section-separator" aria-hidden="true">
                  ·
                </span>
                <span>{connected ? "ESTABLISHED" : "LINK"}</span>
              </span>
              <h1>{connected ? "Signal resolved" : "Establish link"}</h1>
            </div>
          </div>

          <div className="panel-viewport" aria-hidden={!needsAccess}>
            <section
              className="machine-panel connection-panel"
              aria-hidden={connected}
            >
              <PanelHardware code={privateKeyMode ? "KEY/01" : "ACCESS/00"} />
              <div className="connection-copy">
                <span className="panel-kicker">
                  {privateKeyMode ? (
                    <KeyRound size={14} />
                  ) : (
                    <Link2 size={14} />
                  )}
                  {privateKeyMode ? "Private key" : "Module mounted"}
                </span>
                <h2>
                  {privateKeyMode ? "Enter your private key" : "Who are you?"}
                </h2>
                <p>
                  {privateKeyMode ? (
                    <>
                      <span className="private-key-warning">
                        Make sure you understand the risks before continuing.
                      </span>{" "}
                      Private keys entered into any webpage are unsafe and may
                      be read by browser extensions. This key stays only on this
                      page and is cleared when you leave or reload.
                    </>
                  ) : (
                    <>
                      Link required for this module.
                      <br />
                      Choose one of the link options to continue.
                    </>
                  )}
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
                        type={privateKeyVisible ? "text" : "password"}
                        value={privateKey}
                        placeholder="0x0123456789…"
                        autoComplete="new-password"
                        spellCheck={false}
                        onChange={(event) => {
                          setPrivateKey(event.currentTarget.value);
                          setPrivateKeyError(undefined);
                        }}
                      />
                      <button
                        type="button"
                        className="private-key-visibility"
                        aria-label={
                          privateKeyVisible
                            ? "Hide private key"
                            : "Show private key"
                        }
                        aria-pressed={privateKeyVisible}
                        onClick={() =>
                          setPrivateKeyVisible((visible) => !visible)
                        }
                      >
                        {privateKeyVisible ? (
                          <EyeOff size={16} />
                        ) : (
                          <Eye size={16} />
                        )}
                      </button>
                    </span>
                  </label>
                  <span className="private-key-message" aria-live="polite">
                    {privateKeyError ?? "64 hexadecimal characters"}
                  </span>
                  <div className="private-key-actions">
                    <button
                      type="button"
                      onClick={() => {
                        setPrivateKey("");
                        setPrivateKeyVisible(false);
                        setPrivateKeyError(undefined);
                        setPrivateKeyMode(false);
                      }}
                    >
                      Back
                    </button>
                    <button type="button" onClick={generatePrivateKey}>
                      Random
                    </button>
                    <button
                      type="submit"
                      className="is-primary"
                      disabled={privateKey.trim().length === 0}
                    >
                      Continue
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
                      <small>For this visit</small>
                      <strong>Enter private key</strong>
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
              <PanelHardware
                code={usingPrivateKey ? "ESTABLISHED/02" : "ESTABLISHED/01"}
              />
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
                      onActiveAddressChange={setActiveAddress}
                    />
                  </div>
                  {telemetry && activeAddress ? (
                    explorerLink(
                      client,
                      "address",
                      activeAddress,
                      <>
                        <span>Balance</span>
                        <strong>{telemetry.balance} CKB</strong>
                      </>,
                      "account-balance",
                    )
                  ) : (
                    <div className="account-balance">
                      <span>Balance</span>
                      <strong>Loading…</strong>
                    </div>
                  )}
                </div>
                <QrCode
                  className="address-qr"
                  value={telemetry ? activeAddress : undefined}
                  title="Current wallet address"
                />
              </div>
            </section>
          </div>
        </section>
      </main>

      <ActivityConsole store={activityLog}>
        <button
          type="button"
          className="network-switch"
          onClick={switchNetwork}
          title="Switch CKB network"
        >
          <Database size={13} /> CKB{" "}
          {client.addressPrefix === "ckb" ? "MAINNET" : "TESTNET"}
        </button>
      </ActivityConsole>
    </>
  );
}

function AddressList({
  addresses,
  onActiveAddressChange,
}: {
  addresses?: string[];
  onActiveAddressChange?: (address: string) => void;
}) {
  const listRef = useRef<HTMLDivElement>(null);
  const addressCount = addresses?.length ?? 0;
  const [activeIndex, setActiveIndex] = useState(0);

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

      const rowStep = getAddressRowStep(list);
      const currentIndex = Math.round(list.scrollTop / rowStep);
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
      onActiveAddressChange?.(addresses?.[nextIndex] ?? "");
      list.scrollTo({ top: nextIndex * rowStep, behavior: "smooth" });
      unlockAfterGesture();
    };

    list.addEventListener("wheel", handleWheel, { passive: false });
    return () => {
      clearTimeout(unlockTimer);
      list.removeEventListener("wheel", handleWheel);
    };
  }, [addressCount, addresses, onActiveAddressChange]);

  return (
    <div
      ref={listRef}
      className={`address-list ${!addresses ? "is-loading" : ""}`}
      aria-label="Wallet addresses"
      onScroll={(event) => {
        const rowStep = getAddressRowStep(event.currentTarget);
        const nextIndex = Math.round(event.currentTarget.scrollTop / rowStep);
        setActiveIndex(nextIndex);
        onActiveAddressChange?.(addresses?.[nextIndex] ?? "");
      }}
    >
      {!addresses ? (
        <div className="address-row is-loading">Reading signer…</div>
      ) : addresses.length === 0 ? (
        <div className="address-row is-loading">No address available</div>
      ) : (
        addresses.map((address, index) => {
          const active = index === activeIndex;
          const className = `address-row ${
            active
              ? "is-active"
              : Math.abs(index - activeIndex) === 1
                ? "is-adjacent"
                : ""
          }`;
          const label = (
            <>
              <span className="address-value address-value-wide">
                {shortenAddress(address, 12)}
              </span>
              <span className="address-value address-value-medium">
                {shortenAddress(address, 10)}
              </span>
              <span className="address-value address-value-compact">
                {shortenAddress(address, 7)}
              </span>
            </>
          );

          if (active) {
            return (
              <CopyableText
                className={className}
                value={address}
                ariaLabel={`Copy address ${address}`}
                iconSize={13}
                key={`${address}-${index}`}
              >
                {label}
              </CopyableText>
            );
          }

          return (
            <button
              type="button"
              className={className}
              title={address}
              aria-label={`Scroll to address ${address}`}
              key={`${address}-${index}`}
              onClick={() => {
                setActiveIndex(index);
                onActiveAddressChange?.(address);
                listRef.current?.scrollTo({
                  top: index * getAddressRowStep(listRef.current),
                  behavior: "smooth",
                });
              }}
            >
              {label}
            </button>
          );
        })
      )}
    </div>
  );
}

function getAddressRowStep(list: HTMLDivElement | null) {
  return list?.querySelector<HTMLElement>(".address-row")?.offsetHeight ?? 42;
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
