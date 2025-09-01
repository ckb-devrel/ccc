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
    let { tx, zeroFeeApplied } = await transferSpore({
      signer,
      // Change this if you have a different sporeId
      id: "0xe1b98f485de4a7cec6161a15a3ae1fc06a9d7170df04d27ba453023254b2c5e3",
      to: owner.script,
      zeroTransferFeeRate: 1000,
    });

    // Complete transaction if zero fee is not applied
    if (!zeroFeeApplied) {
      await tx.completeFeeBy(signer);
      console.log("zero-transfer-fee is not applied, complete fee by signer");
    } else {
      console.log("zero-transfer-fee is applied, skip complete fee");
    }
    tx = await signer.signTransaction(tx);
    console.log(JSON.stringify(JsonRpcTransformers.transactionFrom(tx)));

    // Send transaction
    const txHash = await signer.client.sendTransaction(tx);
    console.log(txHash);
  }, 60000);
});
