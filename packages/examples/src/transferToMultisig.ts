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

// Create a multisig lock script for 2 of 3 signers with 0 must match
const threshold = 2;
const firstNthMustMatch = 0;

const publicKeys = signers.map((signer) => signer.publicKey);
const multisigInfo = ccc.MultisigInfo.from({
  pubkeys: publicKeys,
  threshold,
  mustMatch: firstNthMustMatch,
});
const multisigLockScript = await multisigInfo.defaultMultisigScript(
  signer.client,
);

// Check the multisig address
const multisigAddress = ccc.Address.fromScript(
  multisigLockScript,
  signer.client,
);
console.log("multisig address:", multisigAddress.toString());

// Create a transaction to transfer 1000 CKB to the multisig address
const tx = ccc.Transaction.from({
  outputs: [{ capacity: ccc.fixedPointFrom(1000), lock: multisigLockScript }],
});
await render(tx);

// Complete missing parts: Fill inputs
await tx.completeInputsByCapacity(signer);
await render(tx);

// Complete missing parts: Pay fee
await tx.completeFeeBy(signer);
await render(tx);
