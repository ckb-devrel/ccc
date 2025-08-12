import { ccc } from "@ckb-ccc/core";
import { JsonRpcTransformers } from "@ckb-ccc/core/advanced";
import { describe, expect, it } from "vitest";
import { createSpore, meltSpore } from "..";

describe("meltSpore [testnet]", () => {
  expect(process.env.PRIVATE_KEY).toBeDefined();

  it("should melt a Spore cell by sporeId", async () => {
    const client = new ccc.ClientPublicTestnet();
    const signer = new ccc.SignerCkbPrivateKey(
      client,
      process.env.PRIVATE_KEY!,
    );

    // Build melt transaction
    const { tx: meltTx } = await meltSpore({
      signer,
      // Change this if you have a different sporeId
      id: "0xb0b9f846db65aa152b6ae1244f8826f0e8b3f1c473381138726d0e7b84413d7c",
    });

    // Provide create transaction
    let { tx } = await createSpore({
      signer,
      tx: meltTx,
      data: {
        contentType: "text/plain",
        content: ccc.bytesFrom("hello, spore", "utf8"),
      },
    });

    // Complete transaction
    await tx.completeFeeBy(signer);
    tx = await signer.signTransaction(tx);
    console.log(JSON.stringify(JsonRpcTransformers.transactionFrom(tx)));

    // Send transaction
    const txHash = await signer.sendTransaction(tx);
    console.log(txHash);
  }, 60000);
});
