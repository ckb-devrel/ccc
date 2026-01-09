import { ccc } from "@ckb-ccc/ccc";
import { render, signer } from "@ckb-ccc/playground";

// === Prepare multisig signer ===

const signers = [
  "0x2c56a92a03d767542222432e4f2a0584f01e516311f705041d86b1af7573751f",
  "0x3bc65932a75f76c5b6a04660e4d0b85c2d9b5114efa78e6e5cf7ad0588ca09c8",
  "0xbe06025fbd8c74f65a513a28e62ac56f3227fcb307307a0f2a0ef34d4a66e81f",
].map((key) => new ccc.SignerCkbPrivateKey(signer.client, key));

const publicKeys = signers.map((signer) => signer.publicKey);
const multisigSigner = new ccc.SignerMultisigCkbReadonly(signer.client, {
  publicKeys: publicKeys,
  threshold: 2,
  mustMatch: 0,
});

// === Prepare multisig signer ===

// Check the multisig address
const multisigAddress = await multisigSigner.getRecommendedAddressObj();
console.log("Multisig address:", multisigAddress.toString());

// Create a transaction to transfer 1000 CKB to the multisig address
const tx = ccc.Transaction.from({
  outputs: [
    { capacity: ccc.fixedPointFrom(1000), lock: multisigAddress.script },
  ],
});
await tx.completeFeeBy(signer);
await render(tx);

const txHash = await signer.sendTransaction(tx);
console.log(`Transaction ${txHash} sent`);
