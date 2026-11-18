"use client";

import { createCheckpointQueue } from "./checkpointQueue";
import { RepositoryExamples } from "./components/RepositoryExamples";
import { restoreWorkspaceFocus } from "./workspaceFocus";

import Image from "next/image";

import { ccc } from "@ckb-ccc/connector-react";
import {
  Braces,
  Bug,
  Check,
  ChevronRight,
  Code2,
  Copy,
  Download,
  ExternalLink,
  FileCode2,
  FolderOpen,
  LoaderCircle,
  Play,
  Radio,
  Share2,
  StepForward,
  X,
} from "lucide-react";
import * as prettierTs from "prettier/parser-typescript";
import * as prettierEstree from "prettier/plugins/estree";
import * as prettier from "prettier/standalone";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "./components/Button";
import { Editor } from "./components/Editor";
import { WorkspaceDivider } from "./components/WorkspaceDivider";
import {
  MobileWorkspaceTabs,
  WorkspaceLayoutControls,
} from "./components/WorkspaceLayoutControls";
import { useApp } from "./context";
import { DEFAULT_TRANSFER, VISUAL_EXAMPLE } from "./examples";
import { execute } from "./execute";
import { MissingWalletError } from "./execute/wallet";
import { useWorkspaceLayout } from "./hooks/useWorkspaceLayout";
import { DEFAULT_NOSTR_RELAYS, getFromNEvent, shareToNostr } from "./nostr";
import { Console } from "./tabs/Console";
import { useGetExplorerLink } from "./utils";

export default function Home() {
  const {
    openSigner,
    openAction,
    signer,
    isExampleWallet,
    disconnect,
    clearMessage,
    beginOutputRun,
  } = useApp();
  const { setClient, client, isOpen: isWalletDialogOpen } = ccc.useCcc();
  const { index: explorerUrl } = useGetExplorerLink();
  const [source, setSource] = useState(DEFAULT_TRANSFER);
  const [origin, setOrigin] = useState("Unsaved source");
  const [ready, setReady] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [hasRun, setHasRun] = useState(false);
  const [walletFailure, setWalletFailure] = useState<MissingWalletError>();
  const [next, setNext] = useState<(() => void) | undefined>();
  const [highlight, setHighlight] = useState<number[] | undefined>();
  const [status, setStatus] = useState("Ready to run");
  const displayStatus =
    walletFailure && signer && !isRunning ? "Wallet ready · Run again" : status;
  const [notice, setNotice] = useState("");
  const [dialog, setDialog] = useState<
    "load" | "share" | "examples" | undefined
  >();
  const [loadValue, setLoadValue] = useState("");
  const [shareUrl, setShareUrl] = useState("");
  const [copied, setCopied] = useState(false);
  const [autoClear, setAutoClear] = useState(true);
  const {
    mobilePane,
    setMobilePane,
    split,
    setSplit,
    focusWorkspace,
    setFocusWorkspace,
  } = useWorkspaceLayout();
  const connectionControlsRef = useRef<HTMLDivElement>(null);
  const deferredHistoryRestore = useRef<(() => void) | undefined>(undefined);
  const checkpointQueue = useRef<
    ReturnType<typeof createCheckpointQueue> | undefined
  >(undefined);
  const lastWorkspaceFocus = useRef<HTMLElement | null>(null);
  const walletWasOpen = useRef(false);
  const walletClosing = useRef(false);
  useEffect(() => {
    if (walletWasOpen.current && !isWalletDialogOpen) {
      restoreWorkspaceFocus(
        lastWorkspaceFocus.current,
        connectionControlsRef.current?.querySelector<HTMLElement>(
          "[data-wallet-control]",
        ),
      );
    }
    walletWasOpen.current = isWalletDialogOpen;
    if (!isWalletDialogOpen) {
      walletClosing.current = false;
    }
  }, [isWalletDialogOpen]);
  useEffect(() => {
    if (!isWalletDialogOpen) {
      return;
    }
    const host = document.getElementById("playground-wallet-dialog");
    if (!host) {
      return;
    }
    // Focus only the public host; leave private wallet scenes untouched.
    const frame = requestAnimationFrame(() =>
      host.focus({ preventScroll: true }),
    );
    return () => cancelAnimationFrame(frame);
  }, [isWalletDialogOpen]);
  const panesRef = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const loadVersion = useRef(0);
  const sourceHydrated = useRef(false);
  const running = useRef(false);
  const sourceRef = useRef(source);
  useEffect(() => {
    sourceRef.current = source;
  }, [source]);
  const isTestnet = client.addressPrefix !== "ckb";

  const loadSource = useCallback(
    async (src: string, commitHistory = false) => {
      const version = ++loadVersion.current;
      setIsLoading(true);
      setNotice("");
      try {
        let text: string | undefined;
        if (src.startsWith("nostr:")) {
          text = await getFromNEvent(DEFAULT_NOSTR_RELAYS, src.slice(6));
        } else {
          const url = new URL(src);
          if (!["https:", "http:"].includes(url.protocol)) {
            throw new Error("Use an HTTP(S) source URL or nostr:nevent…");
          }
          const response = await fetch(url, {
            signal: AbortSignal.timeout(15000),
          });
          if (!response.ok) {
            throw new Error(`Source returned HTTP ${response.status}`);
          }
          text = await response.text();
        }
        if (text === undefined) {
          throw new Error("No source was returned");
        }
        if (version !== loadVersion.current) {
          return;
        }
        if (commitHistory) {
          const url = new URL(window.location.href);
          url.searchParams.set("src", src);
          window.history.pushState({}, "", url);
        }
        setSource(text);
        setOrigin(src);
        setNotice("Source loaded. Review the code before running it.");
        setMobilePane("code");
        setDialog(undefined);
      } catch (error) {
        if (version === loadVersion.current) {
          setNotice(`Could not load source: ${String(error)}`);
        }
      } finally {
        if (version === loadVersion.current) {
          setIsLoading(false);
        }
      }
    },
    [setMobilePane],
  );

  useEffect(() => {
    // Never overwrite the existing local draft with an imported script.
    const restore = () => {
      // Preserve the executing source and highlight mapping until it settles.
      if (running.current) {
        deferredHistoryRestore.current = restore;
        return;
      }
      deferredHistoryRestore.current = undefined;
      ++loadVersion.current;
      const src = new URLSearchParams(window.location.search).get("src");
      if (src) {
        // Keep a safe visible draft during initial remote loading/failure.
        // Otherwise marking ready could persist DEFAULT_TRANSFER over it.
        if (!sourceHydrated.current) {
          sourceHydrated.current = true;
          try {
            setSource(
              window.localStorage.getItem("playgroundSourceCode") ??
                DEFAULT_TRANSFER,
            );
            setOrigin("Local draft");
          } catch {
            setOrigin("Unsaved source");
          }
        }
        void loadSource(src);
        return;
      }
      sourceHydrated.current = true;
      try {
        setSource(
          window.localStorage.getItem("playgroundSourceCode") ??
            DEFAULT_TRANSFER,
        );
        setOrigin("Local draft");
        setNotice("");
      } catch {
        setNotice(
          "Local storage is unavailable. Download your code to keep a copy.",
        );
      }
      setIsLoading(false);
    };
    restore();
    // Hydrate browser-only source persistence after mount.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setReady(true);
    window.addEventListener("popstate", restore);
    return () => {
      // Invalidate any outstanding async load on unmount.
      // eslint-disable-next-line react-hooks/exhaustive-deps
      ++loadVersion.current;
      deferredHistoryRestore.current = undefined;
      checkpointQueue.current?.dispose();
      window.removeEventListener("popstate", restore);
    };
  }, [loadSource]);

  useEffect(() => {
    if (!ready || origin !== "Local draft") {
      return;
    }
    try {
      window.localStorage.setItem("playgroundSourceCode", source);
    } catch {
      /* The editor remains usable when storage is unavailable. */
    }
  }, [source, origin, ready]);

  useEffect(() => {
    if (dialog) {
      dialogRef.current?.showModal();
    } else {
      dialogRef.current?.close();
    }
  }, [dialog]);

  const runCode = useCallback(
    async (autoPlay: boolean) => {
      if (running.current || isLoading) {
        return;
      }
      setWalletFailure(undefined);
      setHasRun(true);
      running.current = true;
      setIsRunning(true);
      setMobilePane("output");
      setStatus("Executing");
      if (autoClear) {
        clearMessage();
      }
      const outputRun = beginOutputRun();
      const checkpoints = createCheckpointQueue(autoPlay, (pos, advance) => {
        setHighlight(pos);
        setNext(advance ? () => advance : undefined);
        setStatus(
          pos
            ? autoPlay
              ? "Rendering"
              : `Paused at line ${pos[0] + 1}`
            : "Executing",
        );
      });
      checkpointQueue.current = checkpoints;
      try {
        await execute(
          sourceRef.current,
          (pos) => {
            if (!pos || !outputRun.isCurrent() || !running.current) {
              return Promise.resolve();
            }
            return checkpoints.enqueue(pos);
          },
          signer,
          outputRun.log,
          client,
        );
        setStatus("Run complete");
      } catch (error) {
        if (error instanceof MissingWalletError && outputRun.isCurrent()) {
          setWalletFailure(error);
        }
        outputRun.log("error", "Execution failed", [error]);
        setStatus("Run failed");
      } finally {
        running.current = false;
        setIsRunning(false);
        setNext(undefined);
        setHighlight(undefined);
        checkpoints.dispose();
        checkpointQueue.current = undefined;
        deferredHistoryRestore.current?.();
      }
    },
    [
      autoClear,
      clearMessage,
      isLoading,
      beginOutputRun,
      signer,
      setMobilePane,
      client,
    ],
  );

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (
        (event.ctrlKey || event.metaKey) &&
        event.key === "Enter" &&
        !event.shiftKey &&
        !event.altKey &&
        !event.repeat &&
        !event.isComposing &&
        !dialog &&
        !isWalletDialogOpen
      ) {
        event.preventDefault();
        event.stopPropagation();
        if (next) {
          next();
        } else {
          void runCode(true);
        }
      }
    };
    // Let wallet child views consume Escape before closing the outer connector.
    const onEscape = (event: KeyboardEvent) => {
      if (
        isWalletDialogOpen &&
        event.key === "Escape" &&
        !event.defaultPrevented
      ) {
        event.preventDefault();
        if (!walletClosing.current) {
          const host = document.getElementById(
            "playground-wallet-dialog",
          ) as ccc.WebComponentConnector | null;
          if (typeof host?.close === "function") {
            walletClosing.current = true;
            // The connector owns animation and active-scene resource cleanup.
            // Its close event then updates the React provider's visibility.
            host.close();
          }
        }
      }
    };
    // Capture before Monaco handles Ctrl/Cmd+Enter as insertLineAfter.
    window.addEventListener("keydown", onKey, true);
    window.addEventListener("keydown", onEscape);
    return () => {
      window.removeEventListener("keydown", onKey, true);
      window.removeEventListener("keydown", onEscape);
    };
  }, [runCode, next, dialog, isWalletDialogOpen]);

  const replaceSource = (text: string, name: string) => {
    if (
      source !== text &&
      !window.confirm(
        "Replace the editor contents? Download a copy first if you need to keep them.",
      )
    ) {
      return;
    }
    ++loadVersion.current;
    setNotice("");
    setSource(text);
    setOrigin(name);
    if (name === "Local draft") {
      const url = new URL(window.location.href);
      url.searchParams.delete("src");
      window.history.pushState({}, "", url);
    }
    setIsLoading(false);
    setDialog(undefined);
    setMobilePane("code");
  };

  return (
    <main
      inert={isWalletDialogOpen}
      onFocusCapture={(event) => {
        lastWorkspaceFocus.current = event.target as HTMLElement;
      }}
      className={`workbench ${isRunning ? "is-running" : ""} ${focusWorkspace ? "workspace-focused" : ""}`}
    >
      <header
        className={`workbench-header ${isExampleWallet ? "has-example-wallet" : ""}`}
      >
        <a
          className="brand"
          href="https://ckbccc.com/"
          target="_blank"
          rel="noreferrer"
        >
          <Image
            className="brand-logo"
            src="/favicon.svg"
            alt=""
            width={28}
            height={28}
          />
          <strong>CCC</strong>
          <span className="brand-divider" />
          Playground
        </a>
        <nav aria-label="Resources" className="resource-nav">
          <a href="https://docs.ckbccc.com/" target="_blank" rel="noreferrer">
            Docs <ExternalLink size={12} />
          </a>
          <a href="https://app.ckbccc.com/" target="_blank" rel="noreferrer">
            CCC App <ExternalLink size={12} />
          </a>
          <a
            href="https://github.com/ckb-devrel/ccc/tree/dev/packages/playground"
            target="_blank"
            rel="noreferrer"
          >
            Source <ExternalLink size={12} />
          </a>
          <details className="resource-more">
            <summary>More</summary>
            <div>
              <a
                href="https://docs.ckbccc.com/"
                target="_blank"
                rel="noreferrer"
              >
                Documentation
              </a>
              <a
                href="https://app.ckbccc.com/"
                target="_blank"
                rel="noreferrer"
              >
                CCC App
              </a>
              <a
                href="https://github.com/ckb-devrel/ccc/tree/dev/packages/playground"
                target="_blank"
                rel="noreferrer"
              >
                Playground source
              </a>
              <a
                href="https://faucet.nervos.org/"
                target="_blank"
                rel="noreferrer"
              >
                Testnet faucet
              </a>
              <a href={explorerUrl} target="_blank" rel="noreferrer">
                CKBadger explorer
              </a>
              <a
                href="https://www.nervos.org/"
                target="_blank"
                rel="noreferrer"
              >
                Nervos Network
              </a>
              <a
                href="https://x.com/CKBDevrel"
                target="_blank"
                rel="noreferrer"
              >
                CKB DevRel on X
              </a>
            </div>
          </details>
        </nav>
        <div className="connection-controls" ref={connectionControlsRef}>
          <Button
            className={`network-button ${!isTestnet ? "mainnet" : ""}`}
            disabled={isRunning}
            onClick={() =>
              setClient(
                isTestnet
                  ? ccc.ClientPublicMainnet.open()
                  : ccc.ClientPublicTestnet.open(),
              )
            }
          >
            <span className="status-light" />
            {isTestnet ? "Testnet" : "Mainnet"}
          </Button>
          {isExampleWallet ? (
            <div className="example-wallet-control">
              <span title="Read-only example address. No private key; cannot sign or send.">
                {openAction} <small>read-only</small>
              </span>
              <Button
                disabled={isRunning}
                onClick={openSigner}
                title="Connect your own wallet"
                aria-label="Connect real wallet"
                data-wallet-control
              >
                <span className="real-wallet-label">Connect real wallet</span>
                <span className="real-wallet-label-short" aria-hidden="true">
                  Connect
                </span>
              </Button>
              <Button
                disabled={isRunning}
                onClick={disconnect}
                title="Disconnect example wallet"
                aria-label="Disconnect example wallet"
              >
                <X size={14} />
              </Button>
            </div>
          ) : (
            <Button
              disabled={isRunning}
              onClick={openSigner}
              data-wallet-control
            >
              {openAction}
            </Button>
          )}
        </div>
      </header>
      {notice && (
        <div className="notice" role="status">
          <span>{notice}</span>
          <button aria-label="Dismiss notice" onClick={() => setNotice("")}>
            <X size={16} />
          </button>
        </div>
      )}
      <MobileWorkspaceTabs pane={mobilePane} onPaneChange={setMobilePane} />
      <div
        className="workspace-panes"
        ref={panesRef}
        style={{
          gridTemplateColumns: `minmax(0, ${split}fr) 10px minmax(0, ${100 - split}fr)`,
        }}
        data-mobile-pane={mobilePane}
      >
        <section className="editor-panel" aria-label="Code editor">
          <div className="panel-heading">
            <span>
              <Code2 size={15} />
              <strong>01</strong> SOURCE
            </span>
            <span className="file-label">playground.tsx</span>
          </div>
          <div className="source-origin" title={origin}>
            <span className="status-light" />
            {origin === "Local draft"
              ? "Local draft · saved in this browser"
              : origin}
          </div>
          <div className="editor-surface">
            <Editor
              value={source}
              onChange={(v) => {
                if (!isLoading && !isRunning) {
                  setSource(v ?? "");
                }
              }}
              isLoading={isLoading}
              readOnly={isRunning || isLoading}
              highlight={highlight}
            />
          </div>
          <div className="editor-toolbar">
            <div className="toolbar-group">
              <Button
                disabled={isRunning || isLoading}
                title="Format TypeScript"
                onClick={async () => {
                  try {
                    setSource(
                      await prettier.format(source, {
                        parser: "typescript",
                        plugins: [prettierTs, prettierEstree],
                      }),
                    );
                  } catch (error) {
                    setNotice(`Could not format: ${String(error)}`);
                  }
                }}
              >
                <Braces size={15} />
                <span>Format</span>
              </Button>
              <Button
                title="Download source"
                onClick={() => {
                  const url = URL.createObjectURL(
                    new Blob([source], { type: "text/plain" }),
                  );
                  const link = document.createElement("a");
                  link.href = url;
                  link.download = "ccc-playground.tsx";
                  link.click();
                  setTimeout(() => URL.revokeObjectURL(url), 1000);
                }}
              >
                <Download size={15} />
                <span>Save</span>
              </Button>
            </div>
            <div className="toolbar-group">
              {next ? (
                <Button className="primary" onClick={next}>
                  <StepForward size={15} />
                  Continue
                </Button>
              ) : (
                <>
                  <Button
                    disabled={isRunning || isLoading}
                    onClick={() => void runCode(false)}
                  >
                    <Bug size={15} />
                    Step
                  </Button>
                  <Button
                    className="primary"
                    disabled={isRunning || isLoading}
                    onClick={() => void runCode(true)}
                  >
                    {isRunning ? (
                      <LoaderCircle size={15} className="animate-spin" />
                    ) : (
                      <Play size={15} />
                    )}
                    Run
                  </Button>
                </>
              )}
            </div>
          </div>
        </section>
        <WorkspaceDivider
          split={split}
          onSplitChange={setSplit}
          panesRef={panesRef}
        />
        <section className="output-panel" aria-label="Code output">
          <Console
            executionStatus={displayStatus}
            hasRun={hasRun}
            walletFailure={walletFailure}
            onRun={() => void runCode(true)}
            isRunning={isRunning}
            autoClear={autoClear}
            onAutoClear={setAutoClear}
          />
        </section>
      </div>
      <footer className="workspace-dock" aria-label="Workspace tools">
        <div className="workspace-heading" id="workspace-tools">
          <h1 className="sr-only">CCC Playground: Code. Run. Inspect.</h1>
          <div className="workspace-actions">
            <Button
              disabled={isRunning || isLoading}
              onClick={() => setDialog("examples")}
            >
              <FileCode2 size={15} />
              Examples
            </Button>
            <Button
              disabled={isRunning || isLoading}
              onClick={() => setDialog("load")}
            >
              <FolderOpen size={15} />
              Load source
            </Button>
            <Button
              disabled={isSharing || isLoading}
              onClick={() => {
                setShareUrl("");
                setDialog("share");
              }}
            >
              <Share2 size={15} />
              Share
            </Button>
          </div>
        </div>
        <span className="dock-status" aria-live="polite">
          <span className={`status-light ${isRunning ? "active" : ""}`} />
          {displayStatus}
        </span>
        <WorkspaceLayoutControls
          focused={focusWorkspace}
          onFocusChange={setFocusWorkspace}
        />
      </footer>
      <dialog
        ref={dialogRef}
        className="workbench-dialog"
        aria-label={
          dialog === "load"
            ? "Load source"
            : dialog === "share"
              ? "Share source"
              : "Choose example"
        }
        onCancel={(event) => {
          if (isSharing) {
            event.preventDefault();
            return;
          }
          ++loadVersion.current;
          setIsLoading(false);
          setDialog(undefined);
        }}
        onClose={() => setDialog(undefined)}
      >
        <div className="dialog-heading">
          <span className="eyebrow">
            {dialog === "load"
              ? "IMPORT SOURCE"
              : dialog === "share"
                ? "PUBLISH SOURCE"
                : "EXAMPLE SCRIPTS"}
          </span>
          <Button
            aria-label="Close dialog"
            disabled={isSharing}
            onClick={() => {
              ++loadVersion.current;
              setIsLoading(false);
              setDialog(undefined);
            }}
          >
            <X size={18} />
          </Button>
        </div>
        {dialog === "load" && (
          <form
            onSubmit={(event) => {
              event.preventDefault();
              if (
                !isLoading &&
                window.confirm(
                  "Load this source into the editor? Your saved local draft will be kept.",
                )
              ) {
                void loadSource(loadValue.trim(), true);
              }
            }}
          >
            <h2>Bring your own code.</h2>
            <p>
              Load a raw HTTP(S) URL or a <code>nostr:nevent…</code> reference.
              Code is loaded, never automatically executed.
            </p>
            <label htmlFor="source-url">Source URL</label>
            <input
              id="source-url"
              required
              value={loadValue}
              onChange={(e) => setLoadValue(e.target.value)}
              placeholder="https://…/example.ts"
              autoFocus
            />
            <div className="dialog-actions">
              <Button
                type="button"
                disabled={isLoading}
                onClick={() => {
                  try {
                    replaceSource(
                      localStorage.getItem("playgroundSourceCode") ??
                        DEFAULT_TRANSFER,
                      "Local draft",
                    );
                  } catch {
                    setNotice("Could not restore the local draft.");
                  }
                }}
              >
                Restore local draft
              </Button>
              <Button className="primary" disabled={isLoading} type="submit">
                {isLoading ? (
                  <LoaderCircle size={16} className="animate-spin" />
                ) : (
                  <FolderOpen size={16} />
                )}
                Load source
              </Button>
            </div>
            {notice && <p role="status">{notice}</p>}
          </form>
        )}
        {dialog === "examples" && (
          <>
            <h2>Start with something small.</h2>
            <p>
              Every example is editable. Build up a transaction, inspect it,
              then make it your own.
            </p>
            <button
              className="example-card"
              onClick={() =>
                replaceSource(VISUAL_EXAMPLE, "Example · Transaction anatomy")
              }
            >
              <span>
                <strong>Transaction anatomy</strong>
                <small>
                  A local transaction preview. No wallet or RPC required.
                </small>
              </span>
              <ChevronRight size={20} />
            </button>
            <button
              className="example-card"
              onClick={() =>
                replaceSource(DEFAULT_TRANSFER, "Example · Build a transfer")
              }
            >
              <span>
                <strong>Build a transfer</strong>
                <small>
                  Build with live chain data on the selected network. Requires a
                  connected or example wallet; does not broadcast.
                </small>
              </span>
              <ChevronRight size={20} />
            </button>
            <RepositoryExamples
              isLoading={isLoading}
              onLoad={(sourceUrl) => {
                if (
                  isLoading ||
                  !window.confirm(
                    "Load this repository example into the editor? Your saved local draft will be kept.",
                  )
                ) {
                  return;
                }
                void loadSource(sourceUrl, true);
              }}
            />
            {notice && <p role="status">{notice}</p>}
            <p className="muted">
              Use <code>await render(value)</code> to create a visual
              checkpoint. Step pauses at each checkpoint.
            </p>
          </>
        )}
        {dialog === "share" && (
          <>
            <h2>A link to your experiment.</h2>
            <p>
              Publish the current code to public Nostr relays. Do not include
              private keys or secrets. Relay storage is not guaranteed to be
              permanent.
            </p>
            {shareUrl ? (
              <>
                <label htmlFor="share-url">Verified share link</label>
                <input id="share-url" readOnly value={shareUrl} />
                <Button
                  className="primary"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(shareUrl);
                      setCopied(true);
                    } catch {
                      setNotice(
                        "Copy unavailable. Select and copy the link above.",
                      );
                    }
                  }}
                >
                  {copied ? <Check size={16} /> : <Copy size={16} />}{" "}
                  {copied ? "Copied" : "Copy link"}
                </Button>
              </>
            ) : (
              <Button
                className="primary"
                disabled={isSharing}
                onClick={async () => {
                  setIsSharing(true);
                  setNotice("");
                  const snapshot = source;
                  try {
                    const id = await shareToNostr(
                      client,
                      DEFAULT_NOSTR_RELAYS,
                      snapshot,
                    );
                    const retrieved = await getFromNEvent(
                      DEFAULT_NOSTR_RELAYS,
                      id,
                    );
                    if (retrieved !== snapshot) {
                      throw new Error("Published code could not be verified");
                    }
                    const url = new URL(
                      window.location.origin + window.location.pathname,
                    );
                    url.searchParams.set("src", `nostr:${id}`);
                    setShareUrl(url.toString());
                    setCopied(false);
                  } catch (error) {
                    setNotice(
                      `Could not verify share: ${String(error)}. A relay may already have stored the code.`,
                    );
                  } finally {
                    setIsSharing(false);
                  }
                }}
              >
                {isSharing ? (
                  <LoaderCircle size={16} className="animate-spin" />
                ) : (
                  <Radio size={16} />
                )}{" "}
                {isSharing ? "Publishing & verifying…" : "Publish to Nostr"}
              </Button>
            )}
            {notice && <p role="status">{notice}</p>}
          </>
        )}
      </dialog>
    </main>
  );
}
