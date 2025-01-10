"use client";

import { ccc } from "@ckb-ccc/connector-react";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/src/components/Button";
import { TextInput } from "@/src/components/Input";
import * as bip39 from "@scure/bip39";
import { wordlist } from "@scure/bip39/wordlists/english";
import { HDKey } from "@scure/bip32";
import { useApp } from "@/src/context";
import { ButtonsPanel } from "@/src/components/ButtonsPanel";

export default function Mnemonic() {
  const { client } = ccc.useCcc();
  const { createSender } = useApp();
  const { log } = createSender("Mnemonic");

  const [mnemonic, setMnemonic] = useState<string>("");
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
  const isValid = useMemo(
    () => bip39.validateMnemonic(mnemonic, wordlist),
    [mnemonic],
  );

  const moreAccounts = useCallback(async () => {
    const count = parseInt(countStr, 10);
    const seed = await bip39.mnemonicToSeed(mnemonic);
    const hdKey = HDKey.fromMasterSeed(seed);
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
  }, [countStr, mnemonic]);

  useEffect(() => {
    setAccount([]);
    if (isValid) {
      moreAccounts();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mnemonic]);

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
    <div className="mb-1 flex w-9/12 flex-col items-stretch">
      <TextInput
        label="Mnemonic"
        placeholder="Mnemonic"
        state={[mnemonic, setMnemonic]}
      />
      <TextInput
        label="Accounts count"
        placeholder="Accounts count"
        state={[countStr, setCountStr]}
      />
      <TextInput
        label="Password"
        placeholder="Set password for Keystore"
        state={[password, setPassword]}
      />
      {accounts.length !== 0 ? (
        <div className="mt-1 w-full overflow-scroll whitespace-nowrap bg-white">
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
          onClick={() => {
            setMnemonic(bip39.generateMnemonic(wordlist));
          }}
        >
          Random Mnemonic
        </Button>
        <Button
          className="ml-2"
          onClick={moreAccounts}
          disabled={!isValid || Number.isNaN(parseInt(countStr, 10))}
        >
          More accounts
        </Button>
        <Button
          className="ml-2"
          onClick={async () => {
            const seed = await bip39.mnemonicToSeed(mnemonic);
            const hdKey = HDKey.fromMasterSeed(seed);
            log(
              JSON.stringify(
                await ccc.keystoreEncrypt(
                  hdKey.privateKey!,
                  hdKey.chainCode!,
                  password,
                ),
              ),
            );
          }}
          disabled={!isValid}
        >
          To Keystore
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
