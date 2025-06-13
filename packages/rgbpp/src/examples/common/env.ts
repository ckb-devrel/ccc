import { ccc } from "@ckb-ccc/shell";

import { PrivateKeyRgbppBtcWallet } from "../../bitcoin/wallet/privateKey/wallet.js";
import { ScriptInfo } from "../../types/rgbpp/index.js";

import { parseAddressType } from "../../bitcoin/index.js";
import { CkbRgbppUnlockSinger } from "../../signer/index.js";
import { NetworkConfig, PredefinedNetwork } from "../../types/network.js";
import { RgbppUdtClient } from "../../udt/index.js";
import { buildNetworkConfig, isMainnet } from "../../utils/index.js";

const utxoBasedChainName = process.env.UTXO_BASED_CHAIN_NAME!;
const ckbPrivateKey = process.env.CKB_SECP256K1_PRIVATE_KEY!;
const utxoBasedChainPrivateKey = process.env.UTXO_BASED_CHAIN_PRIVATE_KEY!;
const utxoBasedChainAddressType = process.env.UTXO_BASED_CHAIN_ADDRESS_TYPE!;
const btcAssetsApiUrl = process.env.BTC_ASSETS_API_URL!;
const btcAssetsApiToken = process.env.BTC_ASSETS_API_TOKEN!;
const btcAssetsApiOrigin = process.env.BTC_ASSETS_API_ORIGIN!;

export async function initializeRgbppEnv(scriptInfos?: ScriptInfo[]): Promise<{
  ckbClient: ccc.Client;
  ckbSigner: ccc.SignerCkbPrivateKey;
  networkConfig: NetworkConfig;
  utxoBasedAccountAddress: string;
  rgbppUdtClient: RgbppUdtClient;
  rgbppBtcWallet: PrivateKeyRgbppBtcWallet;
  ckbRgbppUnlockSinger: CkbRgbppUnlockSinger;
}> {
  const scripts = scriptInfos?.reduce(
    (acc: Record<string, any>, { name, script, cellDep }) => {
      acc.scripts[name] = script;
      acc.cellDeps[name] = cellDep;
      return acc;
    },
    { scripts: {}, cellDeps: {} },
  );

  const ckbClient = isMainnet(utxoBasedChainName)
    ? new ccc.ClientPublicMainnet()
    : new ccc.ClientPublicTestnet();

  const ckbSigner = new ccc.SignerCkbPrivateKey(ckbClient, ckbPrivateKey);

  const addressType = parseAddressType(utxoBasedChainAddressType);

  const networkConfig = buildNetworkConfig(
    utxoBasedChainName as PredefinedNetwork,
    scripts,
  );

  const rgbppUdtClient = new RgbppUdtClient(networkConfig, ckbClient);

  const rgbppBtcWallet = new PrivateKeyRgbppBtcWallet(
    utxoBasedChainPrivateKey,
    addressType,
    networkConfig,
    {
      url: btcAssetsApiUrl,
      token: btcAssetsApiToken,
      origin: btcAssetsApiOrigin,
    },
  );

  return {
    ckbClient,
    ckbSigner,
    networkConfig,
    utxoBasedAccountAddress: await rgbppBtcWallet.getAddress(),
    rgbppUdtClient,
    rgbppBtcWallet,
    ckbRgbppUnlockSinger: new CkbRgbppUnlockSinger(
      ckbClient,
      await rgbppBtcWallet.getAddress(),
      rgbppBtcWallet,
      rgbppBtcWallet,
      rgbppUdtClient.getRgbppScriptInfos(),
    ),
  };
}
