import { ccc } from "@ckb-ccc/core";
import { afterAll, describe, expect, it } from "vitest";
import { findSporesBySigner } from "../spore";

const clientOwner = ccc.ClientPublicTestnet.open();
afterAll(() => clientOwner.dispose());

describe("searchSpores [testnet]", () => {
  expect(process.env.PRIVATE_KEY).toBeDefined();

  it("should search multiple Spore cells under private key", async () => {
    const client = clientOwner.value;
    const signer = new ccc.SignerCkbPrivateKey(
      client,
      process.env.PRIVATE_KEY!,
    );

    // Search Spore cells
    for await (const spore of findSporesBySigner({ signer, order: "desc" })) {
      console.log(spore);
    }
  }, 60000);
});
