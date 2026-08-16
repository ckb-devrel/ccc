"use client";

import { ccc } from "@ckb-ccc/connector-react";
import { HDKey } from "@scure/bip32";
import { useState } from "react";
import { ModuleTextarea } from "../module-textarea";
import type { ModuleRuntimeProps } from "../modules";

type DerivedAccount = { address: string; path: string; privateKey: string };

async function deriveAccounts(
  client: ccc.Client,
  root: HDKey,
  start: number,
  count: number,
) {
  return Promise.all(
    Array.from(
      { length: count },
      async (_, offset): Promise<DerivedAccount> => {
        const path = `m/44'/309'/0'/0/${start + offset}`;
        const key = root.derive(path);
        const privateKey = ccc.hexFrom(key.privateKey!);
        const publicKey = ccc.hexFrom(key.publicKey!);
        const address = await new ccc.SignerCkbPublicKey(
          client,
          publicKey,
        ).getRecommendedAddress();
        return { address, path, privateKey };
      },
    ),
  );
}

export function KeystoreModule({ client, log, show }: ModuleRuntimeProps) {
  const [keystore, setKeystore] = useState("");
  const [password, setPassword] = useState("");
  const [count, setCount] = useState("10");
  const [root, setRoot] = useState<HDKey>();
  const [accounts, setAccounts] = useState<DerivedAccount[]>([]);

  const decrypt = async () => {
    try {
      const { privateKey, chainCode } = await ccc.keystoreDecrypt(
        JSON.parse(keystore),
        password,
      );
      const nextRoot = new HDKey({ privateKey, chainCode });
      const amount = boundedCount(count);
      const next = await deriveAccounts(client, nextRoot, 0, amount);
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
      const next = await deriveAccounts(
        client,
        root,
        accounts.length,
        boundedCount(count),
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
          <label className="module-field module-field-wide">
            <span>Derived accounts</span>
            <ModuleTextarea
              className="module-output"
              readOnly
              value={accountsText(accounts)}
            />
          </label>
        ) : null}
      </div>
      <div className="module-actions">
        <button className="is-primary" type="button" onClick={decrypt}>
          Decrypt
        </button>
        <button type="button" disabled={!root} onClick={more}>
          More accounts
        </button>
        {accounts.length ? (
          <a href={accountsCsv(accounts)} download="ckb_accounts.csv">
            CSV
          </a>
        ) : null}
      </div>
    </div>
  );
}

function boundedCount(value: string) {
  return Math.max(1, Math.min(100, Number.parseInt(value, 10)));
}

function accountsText(accounts: DerivedAccount[]) {
  return accounts
    .map(
      ({ path, address, privateKey }) => `${path}, ${address}, ${privateKey}`,
    )
    .join("\n");
}

function accountsCsv(accounts: DerivedAccount[]) {
  return `data:text/csv;charset=utf-8,${encodeURIComponent(`path,address,private key\n${accountsText(accounts)}`)}`;
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
