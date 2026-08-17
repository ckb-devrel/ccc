"use client";

import { HDKey } from "@scure/bip32";
import { useRef, useState } from "react";
import { DerivedAccounts, type DerivedAccount } from "../derived-accounts";
import { ModuleTextarea } from "../module-textarea";
import type { ModuleRuntimeProps } from "../modules";
import {
  boundedAccountCount,
  decryptHdKeystore,
  deriveCkbAccounts,
} from "./hd-account-rules";

// -----------------------------------------------------------------------------

export function KeystoreModule({ client, log, show }: ModuleRuntimeProps) {
  const [keystore, setKeystore] = useState("");
  const [password, setPassword] = useState("");
  const [count, setCount] = useState("10");
  const [root, setRoot] = useState<HDKey>();
  const [accounts, setAccounts] = useState<DerivedAccount[]>([]);
  const [derivingMore, setDerivingMore] = useState(false);
  const credentialRevision = useRef(0);
  const moreInFlight = useRef(false);

  const decrypt = async () => {
    const revision = credentialRevision.current;
    try {
      const nextRoot = await decryptHdKeystore(keystore, password);
      const amount = boundedAccountCount(count);
      const next = await deriveCkbAccounts(client, nextRoot, 0, amount);
      if (revision !== credentialRevision.current) return;
      setRoot(nextRoot);
      setAccounts(next);
      show({
        label: "KEYSTORE",
        tone: "success",
        content: <strong>Keystore decrypted</strong>,
      });
      log("Keystore decrypted", "success");
    } catch (cause) {
      if (revision === credentialRevision.current) {
        showFailure(cause, show, log);
      }
    }
  };

  const more = async () => {
    if (!root || moreInFlight.current) return;
    moreInFlight.current = true;
    setDerivingMore(true);
    const revision = credentialRevision.current;
    try {
      const next = await deriveCkbAccounts(
        client,
        root,
        accounts.length,
        boundedAccountCount(count),
      );
      if (revision !== credentialRevision.current) return;
      setAccounts((current) => [...current, ...next]);
      show({
        label: "DERIVATION",
        tone: "success",
        content: <strong>{`${next.length} accounts derived`}</strong>,
      });
      log(`${next.length} accounts derived`, "success");
    } catch (cause) {
      if (revision === credentialRevision.current) {
        showFailure(cause, show, log);
      }
    } finally {
      moreInFlight.current = false;
      setDerivingMore(false);
    }
  };

  return (
    <div className="module-console">
      <div className="module-fields">
        <label className="module-field module-field-wide">
          <span>Keystore JSON</span>
          <ModuleTextarea
            value={keystore}
            spellCheck={false}
            onChange={(event) => {
              credentialRevision.current += 1;
              setKeystore(event.currentTarget.value);
              setRoot(undefined);
              setAccounts([]);
            }}
          />
        </label>
        <label className="module-field">
          <span>Password</span>
          <input
            type="password"
            value={password}
            onChange={(event) => {
              credentialRevision.current += 1;
              setPassword(event.currentTarget.value);
              setRoot(undefined);
              setAccounts([]);
            }}
          />
        </label>
        <label className="module-field">
          <span>Accounts per batch</span>
          <input
            value={count}
            inputMode="numeric"
            onChange={(event) => setCount(event.currentTarget.value)}
          />
        </label>
        {accounts.length ? (
          <DerivedAccounts
            accounts={accounts}
            onCopyError={(cause) => showFailure(cause, show, log)}
          />
        ) : null}
      </div>
      <div className="module-actions">
        <button className="is-primary" type="button" onClick={decrypt}>
          Decrypt
        </button>
        <button type="button" disabled={!root || derivingMore} onClick={more}>
          {derivingMore ? "Deriving…" : "More accounts"}
        </button>
      </div>
    </div>
  );
}

function showFailure(
  cause: unknown,
  show: ModuleRuntimeProps["show"],
  log: ModuleRuntimeProps["log"],
) {
  const message =
    cause instanceof Error ? cause.message : "Keystore operation failed";
  show({ label: "FAULT", tone: "error", content: <strong>{message}</strong> });
  log(message, "error");
}
