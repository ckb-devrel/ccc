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
import { render, signer, client } from "@ckb-ccc/playground";

// @ts-expect-error Module type mismatch in playground environment
import { buildNetworkConfig, PredefinedNetwork, PredefinedScriptName, createBrowserRgbppBtcWallet, RgbppUdtClient, CkbRgbppUnlockSinger } from "@ckb-ccc/rgbpp";

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
const networkConfig = buildNetworkConfig(
  PredefinedNetwork.BitcoinTestnet3,
  // TODO: remove the following 2 configs after updating RGB++ cell deps in ccc
  {
    cellDeps: {
      [PredefinedScriptName.RgbppLock]: ccc.CellDep.from({
        outPoint: {
          txHash:
            "0x0d1567da0979f78b297d5311442669fbd1bd853c8be324c5ab6da41e7a1ed6e5",
          index: "0x0",
        },
        depType: "code",
      }),
      [PredefinedScriptName.BtcTimeLock]: ccc.CellDep.from({
        outPoint: {
          txHash:
            "0x8fb747ff0416a43e135c583b028f98c7b81d3770551b196eb7ba1062dd9acc94",
          index: "0x0",
        },
        depType: "code",
      }),
    },
  },
);

const btcRgbppSigner = await createBrowserRgbppBtcWallet(
  signer,
  networkConfig,
  {
    url: "https://api-testnet.rgbpp.com",
    isMainnet: signer.client.addressPrefix === "ckt",
  },
);
if (!btcRgbppSigner) {
  throw new Error("Failed to create browser RGBPP BTC singer");
}

const rgbppUdtClient = new RgbppUdtClient(networkConfig, signer.client);
const ckbRgbppUnlockSinger = new CkbRgbppUnlockSinger(
  signer.client,
  await btcRgbppSigner.getAddress(),
  btcRgbppSigner,
  btcRgbppSigner,
  rgbppUdtClient.getRgbppScriptInfos(),
);

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
const utxoSeal = await btcRgbppSigner.prepareUtxoSeal({ feeRate: 7 });

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
