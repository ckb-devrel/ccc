import { ccc } from "@ckb-ccc/core";

import {
  buildNetworkConfig,
  isMainnet,
  NetworkConfig,
  parseAddressType,
  PredefinedNetwork,
  RgbppPrivateKeyBtcWallet,
} from "../../bitcoin/index.js";

import { BtcAssetsApi } from "../../data-source/index.js";
import { ClientScriptProvider } from "../../script/index.js";
import { CkbRgbppUnlockSigner } from "../../signer/index.js";
import { RgbppUdtClient } from "../../udt/index.js";

const utxoBasedChainName = process.env.UTXO_BASED_CHAIN_NAME!;
const ckbPrivateKey = process.env.CKB_SECP256K1_PRIVATE_KEY!;
const utxoBasedChainPrivateKey = process.env.UTXO_BASED_CHAIN_PRIVATE_KEY!;
const utxoBasedChainAddressType = process.env.UTXO_BASED_CHAIN_ADDRESS_TYPE!;
const btcAssetsApiUrl = process.env.BTC_ASSETS_API_URL!;
const btcAssetsApiToken = process.env.BTC_ASSETS_API_TOKEN!;
const btcAssetsApiOrigin = process.env.BTC_ASSETS_API_ORIGIN!;

export async function initializeRgbppEnv(): Promise<{
  ckbClient: ccc.Client;
  ckbSigner: ccc.SignerCkbPrivateKey;
  networkConfig: NetworkConfig;
  utxoBasedAccountAddress: string;
  rgbppUdtClient: RgbppUdtClient;
  rgbppBtcWallet: RgbppPrivateKeyBtcWallet;
  ckbRgbppUnlockSigner: CkbRgbppUnlockSigner;
}> {
  const ckbClient = isMainnet(utxoBasedChainName)
    ? new ccc.ClientPublicMainnet()
    : new ccc.ClientPublicTestnet();

  const ckbSigner = new ccc.SignerCkbPrivateKey(ckbClient, ckbPrivateKey);

  const addressType = parseAddressType(utxoBasedChainAddressType);

  const networkConfig = buildNetworkConfig(
    utxoBasedChainName as PredefinedNetwork,
  );

  const rgbppUdtClient = new RgbppUdtClient(
    ckbClient,
    new ClientScriptProvider(ckbClient),
  );

  const rgbppDataSource = new BtcAssetsApi({
    url: btcAssetsApiUrl,
    token: btcAssetsApiToken,
    origin: btcAssetsApiOrigin,
    isMainnet: networkConfig.isMainnet,
  });

  const rgbppBtcWallet = new RgbppPrivateKeyBtcWallet(
    utxoBasedChainPrivateKey,
    addressType,
    networkConfig,
    rgbppDataSource,
    {
      logger: console,
    },
  );

  return {
    ckbClient,
    ckbSigner,
    networkConfig,
    utxoBasedAccountAddress: await rgbppBtcWallet.getAddress(),
    rgbppUdtClient,
    rgbppBtcWallet,
    ckbRgbppUnlockSigner: new CkbRgbppUnlockSigner({
      ckbClient,
      rgbppBtcAddress: await rgbppBtcWallet.getAddress(),
      rgbppDataSource,
      scriptInfos: await rgbppUdtClient.scriptManager.getRgbppScriptInfos(),
    }),
  };
}
