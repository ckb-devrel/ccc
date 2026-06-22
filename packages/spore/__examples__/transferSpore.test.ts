import { ccc } from "@ckb-ccc/core";
import { JsonRpcTransformers } from "@ckb-ccc/core/advanced";
import { describe, expect, it } from "vitest";
import { transferSpore } from "../index.js";

describe("transferSpore [testnet]", () => {
  expect(process.env.PRIVATE_KEY).toBeDefined();

  it("should transfer a Spore cell by sporeId", async () => {
    const client = new ccc.ClientPublicTestnet();
    const signer = new ccc.SignerCkbPrivateKey(
      client,
      process.env.PRIVATE_KEY!,
    );

    // Create a new owner
    const owner = await ccc.Address.fromString(
      "ckt1qzda0cr08m85hc8jlnfp3zer7xulejywt49kt2rr0vthywaa50xwsqv5puz2ee96nuh9nmc6rtm0n8v7agju4rgdmxlnk",
      signer.client,
    );

    // Build transaction
    let { tx } = await transferSpore({
      signer,
      // Change this if you have a different sporeId
      id: "0x293c6e579dcb8a66f9877517ea45bc9bba0d2513b33970606dfd2c6f3d27c2f0",
      to: owner.script,
    });

    // Complete transaction
    await tx.completeFeeBy(signer);
    tx = await signer.signTransaction(tx);
    console.log(JSON.stringify(JsonRpcTransformers.transactionFrom(tx)));

    // Send transaction
    const txHash = await signer.client.sendTransaction(tx);
    console.log(txHash);
  }, 60000);
});
