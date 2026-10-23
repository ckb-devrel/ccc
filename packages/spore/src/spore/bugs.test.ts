import { ccc } from "@ckb-ccc/core";
import { afterEach, describe, expect, it, vi } from "vitest";
import { packRawClusterData } from "../codec/cluster.js";
import { packRawSporeData } from "../codec/spore.js";
import {
  getClusterScriptInfo,
  getSporeScriptInfo,
} from "../predefined/index.js";
import { prepareCluster } from "./advanced.js";
import { findSpores, findSporesBySigner } from "./index.js";

const lock = {
  codeHash: `0x${"00".repeat(32)}`,
  hashType: "type",
  args: "0x",
} as const;
const clusterId = `0x${"66".repeat(32)}`;

function offlineTestnet(): ccc.ClientPublicTestnet {
  const client = ccc.ClientPublicTestnet.new({
    cache: new ccc.ClientCacheMemory(),
    transport: {
      request: async () => {
        throw new Error("Unexpected request");
      },
    },
  });
  // Search the cells marked usable below. Do not ask a node.
  vi.spyOn(client, "findCellsOnChain").mockImplementation(
    async function* () {},
  );
  return client;
}

describe("prepareCluster lockProxy", () => {
  let client: ccc.ClientPublicTestnet;

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("adds one cluster-owner output when two spores share a cluster", async () => {
    client = offlineTestnet();
    await client.cache.markUsable({
      outPoint: { txHash: `0x${"77".repeat(32)}`, index: 0 },
      cellOutput: {
        lock,
        type: { ...getClusterScriptInfo(client), args: clusterId },
      },
      outputData: packRawClusterData({ name: "", description: "" }),
    });
    const tx = ccc.Transaction.from({
      inputs: [
        {
          previousOutput: { txHash: `0x${"88".repeat(32)}`, index: 0 },
          cellOutput: { capacity: 0, lock },
          outputData: "0x",
        },
      ],
    });
    const signer = new ccc.SignerCkbScriptReadonly(client, lock);
    const spore = { contentType: "", content: "0x", clusterId };

    await prepareCluster(signer, tx, spore, "lockProxy");
    expect(tx.inputs).toHaveLength(1);
    expect(tx.outputs).toHaveLength(1);

    await prepareCluster(signer, tx, spore, "lockProxy");

    expect(tx.inputs).toHaveLength(1);
    expect(tx.outputs).toHaveLength(1);
    expect(tx.outputs[0].lock.eq(lock)).toBe(true);
  });
});

describe("findSpores clusterId filter", () => {
  let client: ccc.ClientPublicTestnet;

  afterEach(() => {
    vi.restoreAllMocks();
  });

  async function cachePublicAndClusteredSpores() {
    client = offlineTestnet();
    const { codeHash, hashType } = getSporeScriptInfo(client);
    for (const [i, id] of [undefined, clusterId].entries()) {
      await client.cache.markUsable({
        outPoint: { txHash: `0x${"77".repeat(32)}`, index: i },
        cellOutput: {
          lock,
          type: { codeHash, hashType, args: `0x${`0${i}`.repeat(32)}` },
        },
        outputData: packRawSporeData({
          contentType: "",
          content: "0x",
          clusterId: id,
        }),
      });
    }
  }

  async function clusterIdsOf(
    spores: AsyncIterable<{ sporeData: { clusterId?: ccc.HexLike } }>,
  ): Promise<(ccc.HexLike | undefined)[]> {
    const found: (ccc.HexLike | undefined)[] = [];
    for await (const { sporeData } of spores) {
      found.push(sporeData.clusterId);
    }
    return found;
  }

  it("returns only public spores when clusterId is an empty string", async () => {
    await cachePublicAndClusteredSpores();

    await expect(
      clusterIdsOf(findSpores({ client, lock, clusterId: "" })),
    ).resolves.toEqual([undefined]);
    await expect(
      clusterIdsOf(
        findSporesBySigner({
          signer: new ccc.SignerCkbScriptReadonly(client, lock),
          clusterId: "",
        }),
      ),
    ).resolves.toEqual([undefined]);
  });

  it("returns every spore when clusterId is omitted and one cluster when it is set", async () => {
    await cachePublicAndClusteredSpores();
    const signer = new ccc.SignerCkbScriptReadonly(client, lock);

    await expect(clusterIdsOf(findSpores({ client, lock }))).resolves.toEqual([
      undefined,
      clusterId,
    ]);
    await expect(clusterIdsOf(findSporesBySigner({ signer }))).resolves.toEqual(
      [undefined, clusterId],
    );
    await expect(
      clusterIdsOf(findSpores({ client, lock, clusterId })),
    ).resolves.toEqual([clusterId]);
    await expect(
      clusterIdsOf(
        findSporesBySigner({
          signer,
          clusterId: ccc.bytesFrom(clusterId),
        }),
      ),
    ).resolves.toEqual([clusterId]);
  });
});
