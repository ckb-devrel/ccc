import { ccc } from "@ckb-ccc/core";
import { findSporesBySigner } from "../spore";

describe("searchSpores [testnet]", () => {
  expect(process.env.PRIVATE_KEY).toBeDefined();

  it("should search multiple Spore cells under private key", async () => {
    const client = new ccc.ClientPublicTestnet();
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
