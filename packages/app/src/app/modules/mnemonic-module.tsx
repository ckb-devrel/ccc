"use client";

import * as bip39 from "@scure/bip39";
import { wordlist } from "@scure/bip39/wordlists/english.js";
import { useMemo, useState } from "react";
import { CopyableReadoutValue } from "../copyable-readout-value";
import { DerivedAccounts, type DerivedAccount } from "../derived-accounts";
import { ModuleTextarea } from "../module-textarea";
import type { ModuleRuntimeProps } from "../modules";
import {
  boundedAccountCount,
  deriveCkbAccounts,
  encryptMnemonicKeystore,
  mnemonicToHdKey,
} from "./hd-account-rules";

// -----------------------------------------------------------------------------

export function MnemonicModule({ client, log, show }: ModuleRuntimeProps) {
  const [mnemonic, setMnemonic] = useState("");
  const [password, setPassword] = useState("");
  const [count, setCount] = useState("10");
  const [accounts, setAccounts] = useState<DerivedAccount[]>([]);
  const valid = useMemo(
    () => bip39.validateMnemonic(mnemonic, wordlist),
    [mnemonic],
  );

  function showKeystore(keystore: string) {
    show({
      label: "KEYSTORE",
      tone: "success",
      content: (
        <CopyableReadoutValue
          value={keystore}
          onError={(cause) => showFailure(cause, show, log)}
        />
      ),
    });
  }

  const derive = async () => {
    try {
      const amount = boundedAccountCount(count);
      const next = await deriveCkbAccounts(
        client,
        await mnemonicToHdKey(mnemonic),
        accounts.length,
        amount,
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

  const makeKeystore = async () => {
    try {
      const keystore = await encryptMnemonicKeystore(mnemonic, password);
      showKeystore(keystore);
      log(keystore, "success");
    } catch (cause) {
      showFailure(cause, show, log);
    }
  };

  return (
    <div className="module-console">
      <div className="module-fields">
        <label className="module-field module-field-wide">
          <span>Mnemonic</span>
          <ModuleTextarea
            value={mnemonic}
            placeholder="BIP-39 mnemonic"
            onChange={(event) => {
              setMnemonic(event.currentTarget.value);
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
        <label className="module-field">
          <span>Keystore password</span>
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.currentTarget.value)}
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
        <button
          type="button"
          onClick={() => {
            setMnemonic(bip39.generateMnemonic(wordlist));
            setAccounts([]);
          }}
        >
          Random
        </button>
        <button
          className="is-primary"
          type="button"
          disabled={!valid}
          onClick={derive}
        >
          Derive
        </button>
        <button type="button" disabled={!valid} onClick={makeKeystore}>
          To keystore
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
    cause instanceof Error ? cause.message : "Mnemonic operation failed";
  show({ label: "FAULT", tone: "error", content: <strong>{message}</strong> });
  log(message, "error");
}
