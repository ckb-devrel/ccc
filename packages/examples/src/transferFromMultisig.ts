import { ccc } from "@ckb-ccc/ccc";
import { render, signer } from "@ckb-ccc/playground";

const ALICE_PRIVATE_KEY =
  "0x2c56a92a03d767542222432e4f2a0584f01e516311f705041d86b1af7573751f";
const BOB_PRIVATE_KEY =
  "0x3bc65932a75f76c5b6a04660e4d0b85c2d9b5114efa78e6e5cf7ad0588ca09c8";
const CHARLES_PRIVATE_KEY =
  "0xbe06025fbd8c74f65a513a28e62ac56f3227fcb307307a0f2a0ef34d4a66e81f";

const signers = [
  new ccc.SignerCkbPrivateKey(signer.client, ALICE_PRIVATE_KEY),
  new ccc.SignerCkbPrivateKey(signer.client, BOB_PRIVATE_KEY),
  new ccc.SignerCkbPrivateKey(signer.client, CHARLES_PRIVATE_KEY),
];
const publicKeys = signers.map((signer) => signer.publicKey);

// Create multisig signers for ALICE, BOB, and CHARLES
const multisigSigners = signers.map(
  (signer) =>
    new ccc.SignerCkbMultisig(signer.client, signer.privateKey, {
      pubkeys: publicKeys,
      threshold: 2,
      mustMatch: 0,
    }),
);

// The receiver is the signer itself
const receiver = await signer.getRecommendedAddress();
console.log("receiver", receiver);

// Parse the receiver script from an address
const { script: lock } = await ccc.Address.fromString(receiver, signer.client);

// Describe what we want
let tx = ccc.Transaction.from({
  outputs: [{ capacity: ccc.fixedPointFrom(200), lock }],
});
await render(tx);

// Complete missing parts: Fill inputs
await tx.completeInputsByCapacity(multisigSigners[0]);
await render(tx);

// Complete missing parts: Pay fee
await tx.completeFeeBy(multisigSigners[0]);
await render(tx);

// Alice checks if the transaction is fulfilled before signing
if (await multisigSigners[0].signaturesFulfilled(tx, true)) {
  console.log("Transaction is fulfilled");
} else {
  console.log("Transaction is not fulfilled");
}

// Alice signs the transaction
tx = await multisigSigners[0].signTransaction(tx);

// Alice checks if the transaction is fulfilled
if (await multisigSigners[0].signaturesFulfilled(tx)) {
  console.log("Alice: signature is fulfilled");
} else {
  console.log("Alice: signature is not fulfilled");
}

// Bob signs the transaction
tx = await multisigSigners[1].signTransaction(tx);

// Bob checks if the transaction is fulfilled
if (await multisigSigners[1].signaturesFulfilled(tx)) {
  console.log("Bob: signature is fulfilled");
} else {
  console.log("Bob: signature is not fulfilled");
}

// Charles checks if the transaction is fulfilled
if (await multisigSigners[2].signaturesFulfilled(tx)) {
  console.log("Charles: signature is fulfilled");
} else {
  console.log("Charles: signature is not fulfilled");
}

// Charles sends the transaction
const txHash = await multisigSigners[2].sendTransaction(tx);
console.log("txHash", txHash);
