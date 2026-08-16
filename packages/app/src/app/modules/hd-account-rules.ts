import { ccc } from "@ckb-ccc/connector-react";
import { HDKey } from "@scure/bip32";
import * as bip39 from "@scure/bip39";
import type { DerivedAccount } from "../derived-accounts";

export function ckbDerivationPath(index: number) {
  return `m/44'/309'/0'/0/${index}`;
}

export async function mnemonicToHdKey(mnemonic: string) {
  return HDKey.fromMasterSeed(await bip39.mnemonicToSeed(mnemonic));
}

export async function deriveCkbAccounts(
  client: ccc.Client,
  root: HDKey,
  start: number,
  count: number,
) {
  return Promise.all(
    Array.from(
      { length: count },
      async (_, offset): Promise<DerivedAccount> => {
        const path = ckbDerivationPath(start + offset);
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

export async function encryptMnemonicKeystore(
  mnemonic: string,
  password: string,
) {
  const root = await mnemonicToHdKey(mnemonic);
  return JSON.stringify(
    await ccc.keystoreEncrypt(root.privateKey!, root.chainCode!, password),
  );
}

export async function decryptHdKeystore(keystore: string, password: string) {
  const { privateKey, chainCode } = await ccc.keystoreDecrypt(
    JSON.parse(keystore),
    password,
  );
  return new HDKey({ privateKey, chainCode });
}

export function boundedAccountCount(value: string) {
  return Math.max(1, Math.min(100, Number.parseInt(value, 10)));
}
