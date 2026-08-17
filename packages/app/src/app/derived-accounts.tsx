"use client";

import { Check, Copy, Download } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { copyText } from "./copy-text";
import { CopyableText } from "./copyable-text";
import styles from "./derived-accounts.module.css";

export type DerivedAccount = {
  address: string;
  path: string;
  privateKey: string;
};

export function DerivedAccounts({
  accounts,
  filename = "ckb_accounts.csv",
  onCopyError,
}: {
  accounts: readonly DerivedAccount[];
  filename?: string;
  onCopyError?: (cause: unknown) => void;
}) {
  const [copied, setCopied] = useState(false);
  const copyTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const csv = useMemo(() => accountsCsv(accounts), [accounts]);
  const download = useMemo(
    () => `data:text/csv;charset=utf-8,${encodeURIComponent(csv)}`,
    [csv],
  );

  useEffect(
    () => () => {
      clearTimeout(copyTimer.current);
    },
    [],
  );

  const copy = () => {
    void copyText(csv)
      .then(() => {
        clearTimeout(copyTimer.current);
        setCopied(true);
        copyTimer.current = setTimeout(() => setCopied(false), 900);
      })
      .catch((cause) => onCopyError?.(cause));
  };

  return (
    <section className={`${styles["derived-accounts"]} module-field-wide`}>
      <header className={styles["derived-accounts-header"]}>
        <span>Derived accounts</span>
        <div className={styles["derived-accounts-actions"]}>
          <button type="button" onClick={copy}>
            {copied ? <Check size={13} /> : <Copy size={13} />}
            <span>{copied ? "Copied" : "Copy CSV"}</span>
          </button>
          <a href={download} download={filename}>
            <Download size={13} />
            <span>CSV</span>
          </a>
        </div>
      </header>
      <div className={styles["derived-accounts-viewport"]}>
        <table>
          <thead>
            <tr>
              <th>Path</th>
              <th>Address</th>
              <th>Private key</th>
            </tr>
          </thead>
          <tbody>
            {accounts.map(({ address, path, privateKey }) => (
              <tr key={path}>
                <td>
                  <DerivedAccountValue
                    label="derivation path"
                    value={path}
                    onCopyError={onCopyError}
                  />
                </td>
                <td className={styles["derived-account-address"]}>
                  <DerivedAccountValue
                    label="address"
                    value={address}
                    onCopyError={onCopyError}
                  />
                </td>
                <td>
                  <DerivedAccountValue
                    label="private key"
                    value={privateKey}
                    onCopyError={onCopyError}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function DerivedAccountValue({
  label,
  onCopyError,
  value,
}: {
  label: string;
  onCopyError?: (cause: unknown) => void;
  value: string;
}) {
  return (
    <CopyableText
      className={styles["derived-account-value"]}
      value={value}
      ariaLabel={`Copy ${label}`}
      onError={onCopyError}
    >
      <span>{value}</span>
    </CopyableText>
  );
}

export function accountsCsv(accounts: readonly DerivedAccount[]) {
  return [
    ["path", "address", "private key"],
    ...accounts.map(({ path, address, privateKey }) => [
      path,
      address,
      privateKey,
    ]),
  ]
    .map((row) => row.map(csvField).join(","))
    .join("\n");
}

function csvField(value: string) {
  return /[",\r\n]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value;
}
