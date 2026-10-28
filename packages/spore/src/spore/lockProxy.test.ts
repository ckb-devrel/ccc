import { ccc } from "@ckb-ccc/core";
import { afterEach, describe, expect, it, vi } from "vitest";
import { packRawClusterData } from "../codec/cluster.js";
import {
  getClusterScriptInfo,
  getSporeScriptInfo,
} from "../predefined/index.js";
import { prepareCluster } from "./advanced.js";
import { createSpore } from "./index.js";

const lock = {
  codeHash: `0x${"00".repeat(32)}`,
  hashType: "type",
  args: "0x",
} as const;
const clusterId = `0x${"66".repeat(32)}`;
const ownerType = {
  codeHash: `0x${"11".repeat(32)}`,
  hashType: "type",
  args: `0x${"22".repeat(32)}`,
} as const;
const ownerData = "0xabcd";

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

async function cacheCluster(client: ccc.ClientPublicTestnet): Promise<void> {
  await client.cache.markUsable({
    outPoint: { txHash: `0x${"77".repeat(32)}`, index: 0 },
    cellOutput: {
      lock,
      type: { ...getClusterScriptInfo(client), args: clusterId },
    },
    outputData: packRawClusterData({ name: "", description: "" }),
  });
}

function matchingOutputs(
  tx: ccc.Transaction,
  type: ccc.ScriptLike | undefined,
  outputData: ccc.HexLike,
): ccc.CellAny[] {
  const typeScript = type ? ccc.Script.from(type) : undefined;
  const data = ccc.hexFrom(outputData);
  return [...tx.outputCells].filter((output) => {
    const sameType = typeScript
      ? output.cellOutput.type?.eq(typeScript) === true
      : !output.cellOutput.type;
    return (
      output.cellOutput.lock.eq(lock) && sameType && output.outputData === data
    );
  });
}

describe("prepareCluster lockProxy", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("adds one cluster-owner output when two spores share a cluster", async () => {
    const client = offlineTestnet();
    await cacheCluster(client);
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
    expect(matchingOutputs(tx, undefined, "0x")).toHaveLength(1);
  });

  it("restores a typed owner input when createSpore mints to the cluster owner", async () => {
    const client = offlineTestnet();
    await cacheCluster(client);
    const ownerCapacity = ccc.fixedPointFrom(100);
    const tx = ccc.Transaction.from({
      inputs: [
        {
          previousOutput: { txHash: `0x${"99".repeat(32)}`, index: 0 },
          cellOutput: { capacity: ownerCapacity, lock, type: ownerType },
          outputData: ownerData,
        },
      ],
    });
    const signer = new ccc.SignerCkbScriptReadonly(client, lock);
    const spore = { contentType: "", content: "0x", clusterId };
    const createParams = {
      signer,
      data: spore,
      to: lock,
      clusterMode: "lockProxy" as const,
    };

    const { tx: created } = await createSpore({ ...createParams, tx });
    const { tx: createdTwice } = await createSpore({
      ...createParams,
      tx: created,
    });

    const sporeType = {
      ...getSporeScriptInfo(client),
      args: createdTwice.outputs[0].type!.args,
    };
    expect(
      matchingOutputs(createdTwice, sporeType, createdTwice.outputsData[0]),
    ).toHaveLength(1);
    const ownerOutputs = matchingOutputs(createdTwice, ownerType, ownerData);
    expect(ownerOutputs).toHaveLength(1);
    expect(ownerOutputs[0].cellOutput.capacity).toBe(ownerCapacity);
  });
});
