"use client";

import { HDKey } from "@scure/bip32";
import { useState } from "react";
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

  const decrypt = async () => {
    try {
      const nextRoot = await decryptHdKeystore(keystore, password);
      const amount = boundedAccountCount(count);
      const next = await deriveCkbAccounts(client, nextRoot, 0, amount);
      setRoot(nextRoot);
      setAccounts(next);
      show({
        label: "KEYSTORE",
        tone: "success",
        content: <strong>Keystore decrypted</strong>,
      });
      log("Keystore decrypted", "success");
    } catch (cause) {
      showFailure(cause, show, log);
    }
  };

  const more = async () => {
    if (!root) return;
    try {
      const next = await deriveCkbAccounts(
        client,
        root,
        accounts.length,
        boundedAccountCount(count),
      );
      setAccounts((current) => [...current, ...next]);
      show({
        label: "DERIVATION",
        tone: "success",
        content: <strong>{`${next.length} accounts derived`}</strong>,
      });
      log(`${next.length} accounts derived`, "success");
    } catch (cause) {
      showFailure(cause, show, log);
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
            onChange={(event) => setKeystore(event.currentTarget.value)}
          />
        </label>
        <label className="module-field">
          <span>Password</span>
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.currentTarget.value)}
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
        <button type="button" disabled={!root} onClick={more}>
          More accounts
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
