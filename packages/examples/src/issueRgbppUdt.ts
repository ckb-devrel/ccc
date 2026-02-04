import { ccc } from "@ckb-ccc/ccc";
import { client, render, signer } from "@ckb-ccc/playground";

// ensure supported wallet is connected
if (!signer || !(signer instanceof ccc.SignerBtc)) {
  throw new Error("Wallet not supported");
}

// only support Testnet for now
if (client.addressPrefix !== "ckt") {
  throw new Error("Only Testnet is supported for now");
}

const btcAddress = await signer.getBtcAccount();

// initialize RGB++ env
const networkConfig = ccc.rgbpp.buildNetworkConfig(
  ccc.rgbpp.PredefinedNetwork.BitcoinTestnet3,
);

const btcRgbppSigner = ccc.rgbpp.createBrowserRgbppBtcWallet(
  signer,
  networkConfig,
  {
    url: "https://api-testnet.rgbpp.com",
    isMainnet: signer.client.addressPrefix === "ckb",
  },
);
if (!btcRgbppSigner) {
  throw new Error("Failed to create browser RGBPP BTC signer");
}

const rgbppUdtClient = new ccc.rgbpp.RgbppUdtClient(
  networkConfig,
  signer.client,
  ccc.rgbpp.createScriptProvider(signer.client),
);
const ckbRgbppUnlockSigner = new ccc.rgbpp.CkbRgbppUnlockSigner({
  ckbClient: signer.client,
  rgbppBtcAddress: await btcRgbppSigner.getAddress(),
  btcDataSource: btcRgbppSigner,
  scriptInfos: await rgbppUdtClient.getRgbppScriptInfos(),
});

const utxos = await btcRgbppSigner.getUtxos(await btcRgbppSigner.getAddress());
if (!utxos.length) {
  throw new Error(
    "No Testnet3 BTC available. Go to a Testnet3 faucet (https://bitcoinfaucet.uo1.net/) to get some.",
  );
}

const ckbBalance = await signer.getBalance();
if (ckbBalance === BigInt(0)) {
  throw new Error(
    "No Testnet CKB available. Go to https://faucet.nervos.org/ to get some.",
  );
}
// This involves BTC transaction confirmation and may take quite some time. Please check the DevTools console for logs.
const utxoSeal = await btcRgbppSigner.prepareUtxoSeal({ feeRate: 3 });

const rgbppIssuanceCells = await rgbppUdtClient.createRgbppUdtIssuanceCells(
  signer,
  utxoSeal,
);
const ckbPartialTx = await rgbppUdtClient.issuanceCkbPartialTx({
  token: {
    name: "Just UDT",
    symbol: "jUDT",
    decimal: 8,
  },
  amount: 2100_0000n,
  rgbppLiveCells: rgbppIssuanceCells,
  udtScriptInfo: await client.getKnownScript(ccc.KnownScript.XUdt),
});

const { psbt, indexedCkbPartialTx } = await btcRgbppSigner.buildPsbt({
  ckbPartialTx,
  ckbClient: signer.client,
  rgbppUdtClient,
  btcChangeAddress: btcAddress,
  receiverBtcAddresses: [btcAddress],
  feeRate: 3,
});
await render(indexedCkbPartialTx);

const btcTxId = await btcRgbppSigner.signAndBroadcast(psbt);
console.log("RGB++ BTC tx id", btcTxId);

const ckbPartialTxInjected = await rgbppUdtClient.injectTxIdToRgbppCkbTx(
  indexedCkbPartialTx,
  btcTxId,
);

// This also involves BTC transaction confirmation. Please check the DevTools console for logs.
const rgbppSignedCkbTx =
  await ckbRgbppUnlockSigner.signTransaction(ckbPartialTxInjected);

await rgbppSignedCkbTx.completeFeeBy(signer);
const ckbFinalTx = await signer.signTransaction(rgbppSignedCkbTx);
console.log("Final RGB++ CKB tx", ckbFinalTx);
await render(ckbFinalTx);

const txHash = await signer.client.sendTransaction(ckbFinalTx);
await ckbRgbppUnlockSigner.client.waitTransaction(txHash);
console.log("RGB++ CKB tx", txHash);
