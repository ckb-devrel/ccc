import { ccc } from "@ckb-ccc/core";
import { describe, expect, it } from "vitest";
import { findSporeClustersBySigner } from "../cluster";

describe("searchClusters [testnet]", () => {
  expect(process.env.PRIVATE_KEY).toBeDefined();

  it("should search multiple Cluster cells under private key", async () => {
    const client = new ccc.ClientPublicTestnet();
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
