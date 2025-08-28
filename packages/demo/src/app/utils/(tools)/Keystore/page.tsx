"use client";

import { Button } from "@/src/components/Button";
import { ButtonsPanel } from "@/src/components/ButtonsPanel";
import { TextInput } from "@/src/components/Input";
import { Textarea } from "@/src/components/Textarea";
import { useApp } from "@/src/context";
import { ccc } from "@ckb-ccc/connector-react";
import { HDKey } from "@scure/bip32";
import { useCallback, useEffect, useState } from "react";

export default function Keystore() {
  const { client } = ccc.useCcc();
  const { createSender } = useApp();
  const { log, error } = createSender("Keystore");

  const [keystore, setKeystore] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [countStr, setCountStr] = useState<string>("10");
  const [accounts, setAccount] = useState<
    {
      publicKey: string;
      privateKey: string;
      address: string;
      path: string;
    }[]
  >([]);
  const [hdKey, setHdKey] = useState<HDKey | undefined>(undefined);
  const moreAccounts = useCallback(async () => {
    if (!hdKey) {
      return;
    }
    const count = parseInt(countStr, 10);
    setAccount((accounts) => [
      ...accounts,
      ...Array.from(new Array(count), (_, i) => {
        const path = `m/44'/309'/0'/0/${i + accounts.length}`;
        const derivedKey = hdKey.derive(path);
        return {
          publicKey: ccc.hexFrom(derivedKey.publicKey!),
          privateKey: ccc.hexFrom(derivedKey.privateKey!),
          path,
          address: "",
        };
      }),
    ]);
  }, [hdKey, countStr]);
  useEffect(() => {
    setAccount([]);
    moreAccounts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hdKey]);

  useEffect(() => {
    setAccount([]);
    setHdKey(undefined);
  }, [keystore, password]);

  useEffect(() => {
    (async () => {
      let modified = false;
      const newAccounts = await Promise.all(
        accounts.map(async (acc) => {
          const address = await new ccc.SignerCkbPublicKey(
            client,
            acc.publicKey,
          ).getRecommendedAddress();
          if (address !== acc.address) {
            modified = true;
          }
          acc.address = address;
          return acc;
        }),
      );
      if (modified) {
        setAccount(newAccounts);
      }
    })();
  }, [client, accounts]);

  return (
    <div className="flex w-full flex-col items-stretch">
      <Textarea
        label="keystore"
        placeholder="Keystore"
        state={[keystore, setKeystore]}
      />
      <TextInput
        label="Accounts count"
        placeholder="Accounts count"
        state={[countStr, setCountStr]}
      />
      <TextInput
        label="Password"
        placeholder="Password"
        state={[password, setPassword]}
      />
      {accounts.length !== 0 ? (
        <div className="mt-1 w-full overflow-scroll bg-white whitespace-nowrap">
          <p>path, address, private key</p>
          {accounts.map(({ privateKey, address, path }) => (
            <p key={path}>
              {path}, {address}, {privateKey}
            </p>
          ))}
        </div>
      ) : undefined}
      <ButtonsPanel>
        <Button
          variant="success"
          onClick={async () => {
            try {
              const { privateKey, chainCode } = await ccc.keystoreDecrypt(
                JSON.parse(keystore),
                password,
              );
              setHdKey(new HDKey({ privateKey, chainCode }));
            } catch (err) {
              error("Invalid");
              throw err;
            }
            log("Valid");
          }}
        >
          Verify Keystore
        </Button>
        <Button
          className="ml-2"
          onClick={moreAccounts}
          disabled={!hdKey || Number.isNaN(parseInt(countStr, 10))}
        >
          More accounts
        </Button>
        {accounts.length !== 0 ? (
          <Button
            as="a"
            className="ml-2"
            href={`data:application/octet-stream,path%2C%20address%2C%20private%20key%0A${accounts
              .map(({ privateKey, address, path }) =>
                encodeURIComponent(`${path}, ${address}, ${privateKey}`),
              )
              .join("\n")}`}
            download={`ckb_accounts_${Date.now()}.csv`}
          >
            Save as CSV
          </Button>
        ) : undefined}
      </ButtonsPanel>
    </div>
  );
}
