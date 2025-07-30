import { ccc } from "@ckb-ccc/core";
import { JsonRpcTransformers } from "@ckb-ccc/core/advanced";
import { describe, expect, it } from "vitest";
import { getSporeScriptInfo, transferSpore } from "../index.js";

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
      id: "0xc2462b641ae89b9bec5ca449e1e6acda8fe530db989cc988ba5077ac76d0f713",
      to: owner.script,
    });

    // Complete transaction
    await tx.completeFeeBy(signer, undefined, undefined, {
      payFeeFromMargin: [
        {
          ...getSporeScriptInfo(signer.client),
        },
      ],
    });
    tx = await signer.signTransaction(tx);
    console.log(JSON.stringify(JsonRpcTransformers.transactionFrom(tx)));

    // Send transaction
    const txHash = await signer.client.sendTransaction(tx);
    console.log(txHash);
  }, 60000);
});
