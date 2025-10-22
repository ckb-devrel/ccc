import { describe, expect, it } from "vitest";
import { ccc } from "../../index";

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
