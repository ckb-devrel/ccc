import { ccc } from "@ckb-ccc/shell";

import dotenv from "dotenv";

import { dirname } from "path";
import { fileURLToPath } from "url";

import {
  AddressType,
  BtcAccount,
  createBtcAccount,
  RgbppBtcWallet,
} from "../../bitcoin/index.js";
import { ScriptInfo } from "../../types/rgbpp/index.js";

import { CkbRgbppUnlockSinger } from "../../signer/index.js";
import { NetworkConfig, PredefinedNetwork } from "../../types/network.js";
import { RgbppUdtClient } from "../../udt/index.js";
import { buildNetworkConfig, isMainnet } from "../../utils/index.js";

dotenv.config({ path: dirname(fileURLToPath(import.meta.url)) + "/../.env" });

const utxoBasedChainName = process.env.UTXO_BASED_CHAIN_NAME!;
const ckbPrivateKey = process.env.CKB_SECP256K1_PRIVATE_KEY!;
const utxoBasedChainPrivateKey = process.env.UTXO_BASED_CHAIN_PRIVATE_KEY!;
const utxoBasedChainAddressType = process.env.UTXO_BASED_CHAIN_ADDRESS_TYPE!;
const btcAssetsApiUrl = process.env.BTC_ASSETS_API_URL!;
const btcAssetsApiToken = process.env.BTC_ASSETS_API_TOKEN!;
const btcAssetsApiOrigin = process.env.BTC_ASSETS_API_ORIGIN!;

export const ckbClient = isMainnet(utxoBasedChainName)
  ? new ccc.ClientPublicMainnet()
  : new ccc.ClientPublicTestnet();

const addressType =
  utxoBasedChainAddressType === "P2TR" ? AddressType.P2TR : AddressType.P2WPKH;

export const ckbSigner = new ccc.SignerCkbPrivateKey(ckbClient, ckbPrivateKey);
// export const ckbAddress = await ckbSigner.getRecommendedAddress();

export function initializeRgbppEnv(scriptInfos?: ScriptInfo[]): {
  networkConfig: NetworkConfig;
  utxoBasedAccount: BtcAccount;
  utxoBasedAccountAddress: string;
  rgbppUdtClient: RgbppUdtClient;
  rgbppBtcWallet: RgbppBtcWallet;
  ckbRgbppUnlockSinger: CkbRgbppUnlockSinger;
} {
  const scripts = scriptInfos?.reduce(
    (acc: Record<string, any>, { name, script, cellDep }) => {
      acc.scripts[name] = script;
      acc.cellDeps[name] = cellDep;
      return acc;
    },
    { scripts: {}, cellDeps: {} },
  );

  const networkConfig = buildNetworkConfig(
    utxoBasedChainName as PredefinedNetwork,
    scripts,
  );

  const utxoBasedAccount = createBtcAccount(
    utxoBasedChainPrivateKey,
    addressType,
    networkConfig.name,
  );

  const rgbppUdtClient = new RgbppUdtClient(networkConfig, ckbClient);

  const rgbppBtcWallet = new RgbppBtcWallet(
    utxoBasedChainPrivateKey,
    addressType,
    networkConfig.name,
    {
      url: btcAssetsApiUrl,
      token: btcAssetsApiToken,
      origin: btcAssetsApiOrigin,
    },
  );

  return {
    networkConfig,
    utxoBasedAccount,
    utxoBasedAccountAddress: utxoBasedAccount.from,
    rgbppUdtClient,
    rgbppBtcWallet,
    ckbRgbppUnlockSinger: new CkbRgbppUnlockSinger(
      ckbClient,
      utxoBasedAccount.from,
      rgbppBtcWallet,
      rgbppBtcWallet,
      rgbppUdtClient.getRgbppScriptInfos(),
    ),
  };
}
