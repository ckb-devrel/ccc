import { ccc } from "@ckb-ccc/core";
import { afterAll, describe, expect, it } from "vitest";
import { findSporeClustersBySigner } from "../cluster";

const clientOwner = ccc.ClientPublicTestnet.open();
afterAll(() => clientOwner.dispose());

describe("searchClusters [testnet]", () => {
  expect(process.env.PRIVATE_KEY).toBeDefined();

  it("should search multiple Cluster cells under private key", async () => {
    const client = clientOwner.value;
    const signer = new ccc.SignerCkbPrivateKey(
      client,
      process.env.PRIVATE_KEY!,
    );

    // Search Cluster cells
    for await (const cluster of findSporeClustersBySigner({
      signer,
      order: "desc",
    })) {
      console.log(cluster);
    }
  }, 60000);
});
