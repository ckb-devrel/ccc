export const DEFAULT_TRANSFER = `import { ccc } from "@ckb-ccc/ccc";
import { render, signer } from "@ckb-ccc/playground";

console.log("Welcome to CCC Playground!");

// The receiver is the signer itself on mainnet
const receiver = signer.client.addressPrefix === "ckb" ?
  await signer.getRecommendedAddress() :
  "ckt1qzda0cr08m85hc8jlnfp3zer7xulejywt49kt2rr0vthywaa50xwsqflz4emgssc6nqj4yv3nfv2sca7g9dzhscgmg28x";
console.log(receiver);

// Parse the receiver script from an address
const { script: lock } = await ccc.Address.fromString(
  receiver,
  signer.client,
);

// Describe what we want
const tx = ccc.Transaction.from({
  outputs: [
    { capacity: ccc.fixedPointFrom(100), lock },
  ],
});
await render(tx);

// Complete missing parts: Fill inputs
await tx.completeInputsByCapacity(signer);
await render(tx);

// Complete missing parts: Pay fee
await tx.completeFeeBy(signer, 1000);
await render(tx);
`;

export const RGBPP_UDT_ISSUANCE = `
import { ccc } from "@ckb-ccc/ccc";
import {
  render,
  signer,
  client,
  initRgbppEnv,
  prepareRgbppUdtIssuanceCells,
} from "@ckb-ccc/playground";

// @ts-expect-error Module type mismatch in playground environment
import { UtxoSeal } from "@ckb-ccc/rgbpp";

// ensure supported wallet is connected
if (!signer || !(signer instanceof ccc.SignerBtc)) {
  throw new Error("Wallet not supported");
}

// only support Testnet for now
if (client.addressPrefix !== "ckt") {
  throw new Error("Only Testnet is supported for now");
}

const btcAddress = await signer.getBtcAccount();
// await render(btcAddress);

// initialize RGB++ signers
const { btcRgbppSigner, rgbppUdtClient, ckbRgbppUnlockSinger } =
  await initRgbppEnv(signer);
// await render(rgbppUdtClient.getRgbppScriptInfos());

const utxos = await btcRgbppSigner.getUtxos(await btcRgbppSigner.getAddress());
if (!utxos.length) {
  throw new Error(
    "No Testnet3 BTC available. Go to a Testnet3 faucet (https://coinfaucet.eu/en/btc-testnet/) to get some.",
  );
}
// await render(utxos);

const ckbBalance = await signer.getBalance();
if (ckbBalance === BigInt(0)) {
  throw new Error(
    "No Testnet CKB available. Go to https://faucet.nervos.org/ to get some.",
  );
}

// await render(await signer.getAddressObjs());
// await render(ckbBalance);

// const utxoSeal: UtxoSeal = {
//   txId: "35766caf72c99d18cd2ca90465d20a86dfcc74e9cdc66fb8a8e6c34fe152910d",
//   index: 2,
// };
const utxoSeal = await btcRgbppSigner.prepareUtxoSeal({ feeRate: 7 });

const rgbppIssuanceCells = await prepareRgbppUdtIssuanceCells(
  signer,
  utxoSeal,
  rgbppUdtClient,
);
const ckbPartialTx = await rgbppUdtClient.issuanceCkbPartialTx({
  token: {
    name: "Just UDT",
    symbol: "jUDT",
    decimal: 8,
  },
  amount: 2100_0000n,
  rgbppLiveCells: rgbppIssuanceCells,
  udtScriptInfo: {
    name: ccc.KnownScript.XUdt,
    script: await ccc.Script.fromKnownScript(client, ccc.KnownScript.XUdt, ""),
    cellDep: (await client.getKnownScript(ccc.KnownScript.XUdt)).cellDeps[0]
      .cellDep,
  },
});

const { psbt, indexedCkbPartialTx } = await btcRgbppSigner.buildPsbt({
  ckbPartialTx,
  ckbClient: signer.client,
  rgbppUdtClient,
  btcChangeAddress: btcAddress,
  receiverBtcAddresses: [btcAddress],
  feeRate: 7,
});
await render("Partial RGB++ CKB tx", indexedCkbPartialTx);

const btcTxId = await btcRgbppSigner.signAndBroadcast(psbt);
await render("RGB++ BTC tx id", btcTxId);

const ckbPartialTxInjected = await rgbppUdtClient.injectTxIdToRgbppCkbTx(
  indexedCkbPartialTx,
  btcTxId,
);
const rgbppSignedCkbTx =
  await ckbRgbppUnlockSinger.signTransaction(ckbPartialTxInjected);
await rgbppSignedCkbTx.completeFeeBy(signer);
const ckbFinalTx = await signer.signTransaction(rgbppSignedCkbTx);
await render("Final RGB++ CKB tx", ckbFinalTx);

const txHash = await signer.client.sendTransaction(ckbFinalTx);
await ckbRgbppUnlockSinger.client.waitTransaction(txHash);
await render("RGB++ CKB tx", txHash);
`;
