import { ccc } from "@ckb-ccc/ccc";
import { render, signer } from "@ckb-ccc/playground";
import { secp256k1 } from "@noble/curves/secp256k1";
import { sha256 } from "@noble/hashes/sha2";

// From https://github.com/bluesky-social/atproto/blob/main/packages/crypto
function plcSign(key: ccc.BytesLike, msg: ccc.BytesLike): ccc.Bytes {
  const msgHash = sha256(ccc.bytesFrom(msg));
  const sig = secp256k1.sign(msgHash, ccc.bytesFrom(key), { lowS: true });
  return sig.toBytes("compact");
}

// Construct create did tx
const { tx } = await ccc.didCkb.createDidCkb({
  signer,
  data: {
    value: { document: {}, localId: "did:plc:yunkr6vorfgzmvzeoofbkhq5" },
  },
});

// Complete missing parts: Fill inputs
await tx.completeInputsByCapacity(signer);
await render(tx);

// Complete missing parts: Pay fee
await tx.completeFeeBy(signer);
await render(tx);

// Authorize the transaction with the rotation key
const rotationKey =
  "0x806d1925698097c64bc70f629e25b91b48a15eee4e492bb239402cee85356a10";
const witness = ccc.didCkb.DidCkbWitness.from({
  localIdAuthorization: {
    history: [
      {
        type: "plc_operation",
        verificationMethods: {
          atproto: "did:key:zQ3shn3qejTEyEiokszFc4MWEqbdAwyj2XR1oS2AuXKvEBTuN",
        },
        rotationKeys: [
          "did:key:zQ3shqtXEdagupBhLzL2vFUACfdVjDEvciip79uY8iHBuu7FD",
          "did:key:zDnaefn5fMKvoZ1n4vyxJ9npjWE5P3D8GkM9zNqaGbLqdDrtX",
        ],
        alsoKnownAs: ["at://alice.example.com"],
        services: {
          atproto_pds: {
            type: "AtprotoPersonalDataServer",
            endpoint: "https://example.com",
          },
        },
        prev: null,
        sig: "2ySrMKwAQ8j_7HlJlNdE9kXFXG6VAGzy0s4P5O12UuMQqUgDHlAe3PQza5zWxIi6TC9K3K8ghmypfhDyJm8LuQ",
      },
    ],
    rotationKeyIndices: [0n, 0n],
    sig: plcSign(rotationKey, tx.hash()),
  },
});
tx.setWitnessArgsAt(0, ccc.WitnessArgs.from({ outputType: witness.toBytes() }));

// Sign and send the transaction
const txHash = await signer.sendTransaction(tx);
console.log(`Transaction ${txHash} sent`);
