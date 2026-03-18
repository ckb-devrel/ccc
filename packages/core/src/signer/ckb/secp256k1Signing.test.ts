import { secp256k1 } from "@noble/curves/secp256k1.js";
import { describe, expect, it } from "vitest";
import { ccc } from "../../index";
import {
  recoverMessageSecp256k1,
  signMessageSecp256k1,
  verifyMessageSecp256k1,
} from "./secp256k1Signing";

const client = new ccc.ClientPublicTestnet();
const signer = new ccc.SignerCkbPrivateKey(
  client,
  "0x0123456789012345678901234567890123456789012345678901234567890123",
);

describe("verifyMessageCkbSecp256k1", () => {
  it("should verify a message signed by SignerCkbPrivateKey", async () => {
    const message = "Hello CKB!";
    const { signature, identity } = await signer.signMessage(message);

    const isValid = ccc.verifyMessageCkbSecp256k1(message, signature, identity);
    expect(isValid).toBe(true);
  });

  it("should fail to verify a message with a wrong signature", async () => {
    const message = "Hello CKB!";
    const { identity } = await signer.signMessage(message);

    const signature =
      "0x0010000000000000000000000000000000000000000000000000000000000000001000000000000000000000000000000000000000000000000000000000000000";

    const isValid = ccc.verifyMessageCkbSecp256k1(message, signature, identity);
    expect(isValid).toBe(false);
  });

  it("should fail to verify a message with a wrong public key", async () => {
    const message = "Hello CKB!";
    const { signature } = await signer.signMessage(message);

    const identity =
      "0x000000000000000000000000000000000000000000000000000000000000000000";

    const isValid = ccc.verifyMessageCkbSecp256k1(message, signature, identity);
    expect(isValid).toBe(false);
  });
});

describe("Secp256k1 Helpers", () => {
  const privateKey =
    "0x0123456789012345678901234567890123456789012345678901234567890123";
  const publicKey = ccc.hexFrom(
    secp256k1.getPublicKey(ccc.bytesFrom(privateKey), true),
  );
  const messageHash =
    "0x1234567890123456789012345678901234567890123456789012345678901234";

  it("should verifies a message", () => {
    const isValid = verifyMessageSecp256k1(
      messageHash,
      "0xf71fd3e5b90289fa939bd3f3c0e263e8ea8e37550417344e58c9b1675084be456c506a30789a6ec98919e5458b3898199b560a41d5262cb18db37058cff339a300",
      publicKey,
    );
    expect(isValid).toBe(true);
  });

  it("should sign and verify a message hash", () => {
    const signature = signMessageSecp256k1(messageHash, privateKey);
    const isValid = verifyMessageSecp256k1(messageHash, signature, publicKey);
    expect(isValid).toBe(true);
  });

  it("should recover the public key from the signature", () => {
    const signature = signMessageSecp256k1(messageHash, privateKey);
    const recovered = recoverMessageSecp256k1(messageHash, signature);
    expect(recovered).toBe(publicKey);
  });

  it("should fail verification with wrong message", () => {
    const signature = signMessageSecp256k1(messageHash, privateKey);
    const wrongMessage =
      "0x0000000000000000000000000000000000000000000000000000000000000000";
    const isValid = verifyMessageSecp256k1(wrongMessage, signature, publicKey);
    expect(isValid).toBe(false);
  });
});
