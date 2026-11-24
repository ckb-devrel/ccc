"use client";
import Image from "next/image";

import { ccc } from "@ckb-ccc/connector-react";
import {
  Braces,
  Bug,
  Code2,
  Download,
  ExternalLink,
  FileCode2,
  FolderOpen,
  LoaderCircle,
  Play,
  Share2,
  StepForward,
  X,
} from "lucide-react";
import type { editor } from "monaco-editor";
import * as prettierTs from "prettier/parser-typescript";
import * as prettierEstree from "prettier/plugins/estree";
import * as prettier from "prettier/standalone";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { Button } from "./components/Button";
import { Editor } from "./components/Editor";
import {
  WorkbenchDialog,
  type WorkbenchDialogKind,
} from "./components/WorkbenchDialog";
import { WorkspaceDivider } from "./components/WorkspaceDivider";
import {
  MobileWorkspaceTabs,
  WorkspaceLayoutControls,
} from "./components/WorkspaceLayoutControls";
import { useApp, useOutputCommands } from "./context";
import { hasSignerNetworkMismatch } from "./execute/wallet";
import { useSourceDocument } from "./hooks/useSourceDocument";
import { useWorkspaceLayout } from "./hooks/useWorkspaceLayout";
import { DEFAULT_NOSTR_RELAYS, getFromNEvent, shareToNostr } from "./nostr";
import { verifyShareAttempt, type ShareAttempt } from "./shareAttempt";
import { sourceOriginLabel } from "./sourceDocument";
import { Console } from "./tabs/Console";
import { useGetExplorerLink } from "./utils";
import {
  createWorkbenchExecution,
  handleExecutionShortcut,
  INITIAL_EXECUTION_VIEW,
} from "./workbenchExecution";
import { restoreWorkspaceFocus } from "./workspaceFocus";

export default function Home() {
  const { openSigner, openAction, signer, isExampleWallet, disconnect } =
    useApp();
  const { clearMessage, beginOutputRun } = useOutputCommands();
  const { setClient, client, isOpen: isWalletDialogOpen } = ccc.useCcc();
  const { index: explorerUrl } = useGetExplorerLink();
  const [isSharing, setIsSharing] = useState(false);
  const [
    { isRunning, hasRun, walletFailure, next, highlight, status },
    setExecutionView,
  ] = useState(INITIAL_EXECUTION_VIEW);
  const [execution] = useState(() =>
    createWorkbenchExecution(setExecutionView),
  );
  useEffect(() => () => execution.dispose(), [execution]);

  const walletNetworkMismatch = hasSignerNetworkMismatch(client, signer);
  const displayStatus =
    !isRunning && walletNetworkMismatch
      ? "Wallet network differs · Wait for it to switch"
      : walletFailure && signer && !isRunning
        ? "Wallet ready · Run again"
        : status;
  const [dialog, setDialog] = useState<WorkbenchDialogKind>();
  const [shareUrl, setShareUrl] = useState("");
  const [shareAttempt, setShareAttempt] = useState<ShareAttempt>();
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
  const onSourceOpened = useCallback(() => {
    setMobilePane("code");
    setDialog(undefined);
  }, [setMobilePane]);
  const [source, sourceDocument] = useSourceDocument(
    execution.isActive,
    onSourceOpened,
  );
  const { text, origin, loading: isLoading, notice, savedDraft } = source;
  const { setNotice } = sourceDocument;
  const originLabel = sourceOriginLabel(origin);
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
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);
  const [hasEditor, setHasEditor] = useState(false);
  const mountEditor = useCallback((instance: editor.IStandaloneCodeEditor) => {
    editorRef.current = instance;
    setHasEditor(true);
  }, []);
  const isTestnet = client.addressPrefix !== "ckb";

  const runCode = useCallback(
    (autoPlay: boolean) => {
      const runnable = sourceDocument.executionSource(
        text,
        isLoading,
        editorRef.current?.getModel()?.getValue(),
      );
      if (runnable === undefined) {
        return;
      }
      return execution.run({
        source: runnable,
        isLoading,
        signer,
        client,
        autoPlay,
        clearOutput: autoClear ? clearMessage : undefined,
        beginOutputRun,
        onStart: () => setMobilePane(autoPlay ? "output" : "code"),
        onSettled: () => void sourceDocument.flushHistory(),
      });
    },
    [
      autoClear,
      beginOutputRun,
      clearMessage,
      client,
      execution,
      isLoading,
      setMobilePane,
      signer,
      sourceDocument,
      text,
    ],
  );

  // Refresh the keyboard handler with the committed wallet and network before paint.
  useLayoutEffect(() => {
    const onKey = (event: KeyboardEvent) =>
      handleExecutionShortcut(
        event,
        Boolean(dialog) || isWalletDialogOpen,
        () => {
          if (next) {
            next();
          } else {
            void runCode(true);
          }
        },
      );
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

  const shareSource = async (pending?: ShareAttempt) => {
    setIsSharing(true);
    setNotice("");
    try {
      const id = await verifyShareAttempt(
        text,
        pending,
        (text) => shareToNostr(client, DEFAULT_NOSTR_RELAYS, text),
        (id) => getFromNEvent(DEFAULT_NOSTR_RELAYS, id),
        setShareAttempt,
      );
      const url = new URL(window.location.origin + window.location.pathname);
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
  };

  const copyShareLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
    } catch {
      setNotice("Copy unavailable. Select and copy the link above.");
    }
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
          <a
            href="https://docs.ckbccc.com/docs/guides/playground"
            target="_blank"
            rel="noreferrer"
          >
            Guide <ExternalLink size={12} />
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
                href="https://docs.ckbccc.com/docs/guides/playground"
                target="_blank"
                rel="noreferrer"
              >
                Playground guide
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
          <div className="source-origin" title={originLabel}>
            <span className="status-light" />
            {origin.kind === "draft"
              ? savedDraft === text
                ? "Local draft · saved in this browser"
                : "Local draft · not saved — use Save to download"
              : originLabel}
          </div>
          <div className="editor-surface">
            <Editor
              value={text}
              onMount={mountEditor}
              onChange={(v) => {
                if (!isLoading && !isRunning) {
                  sourceDocument.edit(v ?? "");
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
                    sourceDocument.edit(
                      await prettier.format(text, {
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
                    new Blob([text], { type: "text/plain" }),
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
                    disabled={
                      !hasEditor ||
                      isRunning ||
                      isLoading ||
                      walletNetworkMismatch
                    }
                    onClick={() => void runCode(false)}
                  >
                    <Bug size={15} />
                    Step
                  </Button>
                  <Button
                    className="primary"
                    disabled={
                      !hasEditor ||
                      isRunning ||
                      isLoading ||
                      walletNetworkMismatch
                    }
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
            runBlocked={walletNetworkMismatch}
            editorReady={hasEditor && !isLoading}
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
      <WorkbenchDialog
        dialog={dialog}
        isLoading={isLoading}
        isSharing={isSharing}
        notice={notice}
        shareUrl={shareUrl}
        hasShareAttempt={Boolean(shareAttempt)}
        copied={copied}
        onDismiss={() => {
          sourceDocument.cancelLoad();
          setDialog(undefined);
        }}
        onClose={() => setDialog(undefined)}
        onImport={sourceDocument.importSource}
        onRestoreDraft={sourceDocument.restoreDraft}
        onCopyLink={copyShareLink}
        onPublishOrVerify={() => void shareSource(shareAttempt)}
        onPublishNew={() => void shareSource()}
      />
    </main>
  );
}
