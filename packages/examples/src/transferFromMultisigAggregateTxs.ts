import { ccc } from "@ckb-ccc/ccc";
import { render, signer } from "@ckb-ccc/playground";

// === Prepare multisig signer ===

const signers = [
  "0x2c56a92a03d767542222432e4f2a0584f01e516311f705041d86b1af7573751f",
  "0x3bc65932a75f76c5b6a04660e4d0b85c2d9b5114efa78e6e5cf7ad0588ca09c8",
  "0xbe06025fbd8c74f65a513a28e62ac56f3227fcb307307a0f2a0ef34d4a66e81f",
].map((key) => new ccc.SignerCkbPrivateKey(signer.client, key));

const publicKeys = signers.map((signer) => signer.publicKey);

const multisigSigners = signers.map(
  (signer) =>
    new ccc.SignerMultisigCkbPrivateKey(signer.client, signer.privateKey, {
      publicKeys: publicKeys,
      threshold: 2,
      mustMatch: 0,
    }),
);

// === Prepare multisig signer ===

const { script: lock } = await signer.getRecommendedAddressObj();
const tx = ccc.Transaction.from({
  outputs: [{ capacity: ccc.fixedPointFrom(200), lock }],
});
await tx.completeFeeBy(multisigSigners[0]);
await render(tx);

const collectedTxs = [];
for (const multisigSigner of multisigSigners) {
  collectedTxs.push(await multisigSigner.signTransaction(tx.clone()));
}

const aggregatedTx =
  await multisigSigners[0].aggregateTransactions(collectedTxs);
console.log(
  `${await multisigSigners[0].getSignaturesCount(aggregatedTx)} signatures aggregated`,
);

const txHash = await signer.client.sendTransaction(aggregatedTx);
console.log(`Transaction ${txHash} sent`);
