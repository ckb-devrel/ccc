import { ccc } from "@ckb-ccc/connector-react";
import {
  ArrowDown,
  ChevronRight,
  CircleAlert,
  Terminal,
  Trash2,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "../components/Button";
import { EmptyOutput } from "../components/EmptyOutput";
import {
  WalletReadyNotice,
  WalletRequiredNotice,
} from "../components/WalletRequiredNotice";
import { type Messages, useApp } from "../context";
import { MissingWalletError } from "../execute/wallet";
import { useFollowOutput } from "../hooks/useFollowOutput";
import {
  createWalletRecoveryTracker,
  isRuntimeError,
  WalletReadyMessage,
} from "../walletRecovery";
import { enhanceDisplay } from "./enhanceDisplay";

function OutputEntry({
  entry,
  index,
  walletFailure,
  onRun,
  isRunning,
  runBlocked,
  activeReady,
}: {
  activeReady?: WalletReadyMessage;
  entry: Messages[number];
  index: number;
  walletFailure?: MissingWalletError;
  onRun: () => void;
  isRunning: boolean;
  runBlocked: boolean;
}) {
  const [level, title, values, , client, isExampleWallet] = entry;
  const [rendered, setRendered] = useState<{
    entry: Messages[number];
    node: React.ReactNode;
  }>();
  const missingWallet =
    values.length === 1 && values[0] instanceof MissingWalletError
      ? values[0]
      : undefined;
  const ready =
    values.length === 1 && values[0] instanceof WalletReadyMessage
      ? values[0]
      : undefined;
  const error = isRuntimeError(level, values);
  const hasTransaction = values.some(
    (value) => value instanceof ccc.Transaction,
  );
  useEffect(() => {
    if (missingWallet || ready) {
      return;
    }
    let active = true;
    Promise.all(values.map((value) => enhanceDisplay(value, client)))
      .then((result) => {
        if (active) {
          setRendered({
            entry,
            node: result.map((node, i) => <div key={i}>{node}</div>),
          });
        }
      })
      .catch((error) => {
        if (active) {
          setRendered({
            entry,
            node: (
              <p className="error-text">
                Could not display output: {String(error)}
              </p>
            ),
          });
        }
      });
    return () => {
      active = false;
    };
  }, [entry, values, client, missingWallet, ready]);
  return (
    <article className={`output-entry ${error ? "output-error" : ""}`}>
      <header>
        <span className="entry-number">
          {String(index + 1).padStart(2, "0")}
        </span>
        <span>
          {error ? <CircleAlert size={13} /> : <ChevronRight size={13} />}{" "}
          {error
            ? "ERROR"
            : ready
              ? "WALLET READY"
              : hasTransaction
                ? "TRANSACTION"
                : "OUTPUT"}
        </span>
        {isExampleWallet && (
          <span className="example-output-label">Example wallet</span>
        )}
        <time>{title}</time>
      </header>
      <div className="entry-content">
        {missingWallet ? (
          <WalletRequiredNotice active={missingWallet === walletFailure} />
        ) : ready ? (
          <WalletReadyNotice
            active={ready === activeReady}
            example={ready.example}
            onRun={onRun}
            isRunning={isRunning}
            runBlocked={runBlocked}
          />
        ) : rendered?.entry === entry ? (
          rendered.node
        ) : (
          <span className="muted">Resolving output…</span>
        )}
      </div>
    </article>
  );
}

export function Console({
  executionStatus,
  hasRun,
  walletFailure,
  onRun,
  isRunning,
  runBlocked,
  autoClear,
  onAutoClear,
}: {
  executionStatus: string;
  hasRun: boolean;
  walletFailure?: MissingWalletError;
  onRun: () => void;
  isRunning: boolean;
  runBlocked: boolean;
  autoClear: boolean;
  onAutoClear: (value: boolean) => void;
}) {
  const { messages, clearMessage, signer, isExampleWallet, sendMessage } =
    useApp();
  const recovery = useRef(createWalletRecoveryTracker());
  const [errorsOnly, setErrorsOnly] = useState(false);
  const visibleFailure = messages.some((entry) =>
    entry[2].includes(walletFailure),
  )
    ? walletFailure
    : undefined;
  const latestReady = messages
    .flatMap((entry) => entry[2])
    .filter(
      (value): value is WalletReadyMessage =>
        value instanceof WalletReadyMessage,
    )
    .at(-1);
  const mode = !signer ? undefined : isExampleWallet ? "example" : "real";
  const activeReady =
    latestReady?.failure === visibleFailure &&
    (!signer || latestReady?.example === isExampleWallet)
      ? latestReady
      : undefined;
  useEffect(() => {
    if (recovery.current(visibleFailure, mode) && visibleFailure) {
      sendMessage("info", "Ready to run", [
        new WalletReadyMessage(visibleFailure, mode === "example"),
      ]);
      // Connection is an explicit recovery action: reveal its new informational entry.
      setErrorsOnly(false);
    }
  }, [visibleFailure, mode, sendMessage]);
  const errors = messages.filter(([level, , values]) =>
    isRuntimeError(level, values),
  ).length;
  const {
    follow,
    toggleFollow,
    resumeFollow,
    viewport,
    content,
    inputHandlers,
  } = useFollowOutput(`${messages.length}:${errorsOnly}`, isRunning);

  return (
    <>
      <span className="sr-only" role="status">
        {runBlocked
          ? executionStatus
          : activeReady && signer
            ? "Wallet ready. Review your code and choose Run current code in the output timeline."
            : ""}
      </span>
      <div className="panel-heading">
        <span>
          <Terminal size={15} />
          <strong>02</strong> OUTPUT{" "}
          <span className="count-badge">{messages.length}</span>
        </span>
        <Button
          disabled={!messages.length}
          onClick={() => {
            clearMessage();
            resumeFollow();
          }}
          title="Clear output"
        >
          <Trash2 size={14} />
          Clear
        </Button>
      </div>
      <div className="output-controls">
        <div className="output-filters">
          <button
            aria-pressed={!errorsOnly}
            onClick={() => setErrorsOnly(false)}
          >
            All output
          </button>
          <button aria-pressed={errorsOnly} onClick={() => setErrorsOnly(true)}>
            Errors {errors > 0 && <span className="error-text">{errors}</span>}
          </button>
        </div>
        <label>
          <input
            type="checkbox"
            checked={autoClear}
            onChange={(event) => onAutoClear(event.target.checked)}
          />
          Clear on run
        </label>
      </div>
      <div
        className="output-scroll"
        data-output-viewport
        ref={viewport}
        tabIndex={0}
        aria-label="Output timeline"
        {...inputHandlers}
      >
        <div ref={content} className="output-content">
          {messages.length === 0 ? (
            <EmptyOutput
              hasRun={hasRun}
              isRunning={isRunning}
              runBlocked={runBlocked}
              onRun={onRun}
            />
          ) : (
            <div className="output-timeline">
              {messages.map(
                (entry, index) =>
                  (!errorsOnly || isRuntimeError(entry[0], entry[2])) && (
                    <OutputEntry
                      key={entry[3]}
                      entry={entry}
                      activeReady={activeReady}
                      index={index}
                      walletFailure={walletFailure}
                      onRun={onRun}
                      isRunning={isRunning}
                      runBlocked={runBlocked}
                    />
                  ),
              )}
              {errorsOnly && errors === 0 && (
                <p className="no-errors">No errors in this run.</p>
              )}
            </div>
          )}
        </div>
      </div>
      <div className="output-footer">
        <span>
          {isRunning || runBlocked
            ? executionStatus
            : messages.length || hasRun
              ? `${messages.length} entries · ${errors} errors`
              : "Nothing runs until you press Run"}
        </span>
        <button aria-pressed={follow} onClick={toggleFollow}>
          <ArrowDown size={12} />
          {follow ? "Following output" : "Follow output"}
        </button>
      </div>
    </>
  );
}
