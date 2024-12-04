import { ccc } from "@ckb-ccc/core";
import { JsonRpcTransformers } from "@ckb-ccc/core/advanced";
import { meltSpore } from "..";

describe("meltSpore [testnet]", () => {
  expect(process.env.PRIVATE_KEY).toBeDefined();

  it("should melt a Spore cell by sporeId", async () => {
    const client = new ccc.ClientPublicTestnet();
    const signer = new ccc.SignerCkbPrivateKey(
      client,
      process.env.PRIVATE_KEY!,
    );

    // Build transaction
    let { tx } = await meltSpore({
      signer,
      // Change this if you have a different sporeId
      id: "0x4ec488fff2fd50ceed11a8906262aa2e40a03bf2f280433459943ed9cf914b83",
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
