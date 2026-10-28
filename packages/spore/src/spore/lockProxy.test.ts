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
const payerLock = {
  codeHash: `0x${"00".repeat(32)}`,
  hashType: "type",
  args: "0x01",
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
    const ownerCapacity = ccc.fixedPointFrom(200);
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

  it.each([
    { label: "a smaller", paymentCkb: 61 },
    { label: "an equal", paymentCkb: 1000 },
  ])(
    "restores the proxy input in addition to $label owner payment",
    async ({ paymentCkb }) => {
      const client = offlineTestnet();
      await cacheCluster(client);
      const paymentCapacity = ccc.fixedPointFrom(paymentCkb);
      const proxyCapacity = ccc.fixedPointFrom(1000);
      const tx = ccc.Transaction.from({
        inputs: [
          {
            previousOutput: { txHash: `0x${"aa".repeat(32)}`, index: 0 },
            cellOutput: { capacity: proxyCapacity, lock },
            outputData: "0x",
          },
          {
            previousOutput: { txHash: `0x${"bb".repeat(32)}`, index: 0 },
            cellOutput: {
              capacity: ccc.fixedPointFrom(2000),
              lock: payerLock,
            },
            outputData: "0x",
          },
        ],
        outputs: [{ capacity: paymentCapacity, lock }],
        outputsData: ["0x"],
      });
      const signer = new ccc.SignerCkbScriptReadonly(client, payerLock);
      const spore = { contentType: "", content: "0x", clusterId };
      const createParams = {
        signer,
        data: spore,
        clusterMode: "lockProxy" as const,
      };

      const { tx: created } = await createSpore({ ...createParams, tx });
      const { tx: createdTwice } = await createSpore({
        ...createParams,
        tx: created,
      });
      await createdTwice.completeFeeBy(signer, 1000n);

      const ownerUntyped = createdTwice.outputs.filter(
        (output) => output.lock.eq(lock) && !output.type,
      );
      expect(ownerUntyped).toHaveLength(2);
      expect(
        ownerUntyped.reduce((sum, output) => sum + output.capacity, 0n),
      ).toBe(paymentCapacity + proxyCapacity);
    },
  );

  it("does not double-restore after clone or JSON rebuild", async () => {
    const client = offlineTestnet();
    await cacheCluster(client);
    const proxyCapacity = ccc.fixedPointFrom(1000);
    const tx = ccc.Transaction.from({
      inputs: [
        {
          previousOutput: { txHash: `0x${"aa".repeat(32)}`, index: 0 },
          cellOutput: { capacity: proxyCapacity, lock },
          outputData: "0x",
        },
        {
          previousOutput: { txHash: `0x${"bb".repeat(32)}`, index: 0 },
          cellOutput: { capacity: ccc.fixedPointFrom(2000), lock: payerLock },
          outputData: "0x",
        },
      ],
    });
    const signer = new ccc.SignerCkbScriptReadonly(client, payerLock);
    const spore = { contentType: "", content: "0x", clusterId };
    const createParams = {
      signer,
      data: spore,
      clusterMode: "lockProxy" as const,
    };

    const { tx: created } = await createSpore({ ...createParams, tx });
    const cloned = created.clone();
    const rebuilt = ccc.Transaction.from(
      JSON.parse(created.stringify()) as ccc.TransactionLike,
    );

    const { tx: afterClone } = await createSpore({
      ...createParams,
      tx: cloned,
    });
    const { tx: afterJson } = await createSpore({
      ...createParams,
      tx: rebuilt,
    });

    for (const next of [afterClone, afterJson]) {
      const restores = next.outputs.filter(
        (output) => output.lockProxyRestoredFrom,
      );
      expect(restores).toHaveLength(1);
      expect(restores[0].capacity).toBe(proxyCapacity);
    }
  });

  it("restores independently on two txs that share a CellInput", async () => {
    const client = offlineTestnet();
    await cacheCluster(client);
    const proxyCapacity = ccc.fixedPointFrom(1000);
    const sharedInput = ccc.CellInput.from({
      previousOutput: { txHash: `0x${"aa".repeat(32)}`, index: 0 },
      cellOutput: { capacity: proxyCapacity, lock },
      outputData: "0x",
    });
    const signer = new ccc.SignerCkbScriptReadonly(client, lock);
    const spore = { contentType: "", content: "0x", clusterId };
    const tx1 = ccc.Transaction.from({ inputs: [sharedInput] });
    const tx2 = ccc.Transaction.from({ inputs: [sharedInput] });

    await prepareCluster(signer, tx1, spore, "lockProxy");
    await prepareCluster(signer, tx2, spore, "lockProxy");

    expect(
      tx1.outputs.filter((output) => output.lockProxyRestoredFrom),
    ).toHaveLength(1);
    expect(
      tx2.outputs.filter((output) => output.lockProxyRestoredFrom),
    ).toHaveLength(1);
    expect(tx1.outputs[0].capacity).toBe(proxyCapacity);
    expect(tx2.outputs[0].capacity).toBe(proxyCapacity);
  });

  it("re-adds a restore after that output is removed", async () => {
    const client = offlineTestnet();
    await cacheCluster(client);
    const proxyCapacity = ccc.fixedPointFrom(1000);
    const tx = ccc.Transaction.from({
      inputs: [
        {
          previousOutput: { txHash: `0x${"aa".repeat(32)}`, index: 0 },
          cellOutput: { capacity: proxyCapacity, lock },
          outputData: "0x",
        },
      ],
    });
    const signer = new ccc.SignerCkbScriptReadonly(client, lock);
    const spore = { contentType: "", content: "0x", clusterId };

    await prepareCluster(signer, tx, spore, "lockProxy");
    const restoreIndex = tx.outputs.findIndex(
      (output) => output.lockProxyRestoredFrom,
    );
    expect(restoreIndex).toBeGreaterThanOrEqual(0);
    tx.outputs.splice(restoreIndex, 1);
    tx.outputsData.splice(restoreIndex, 1);

    await prepareCluster(signer, tx, spore, "lockProxy");

    const restores = tx.outputs.filter(
      (output) => output.lockProxyRestoredFrom,
    );
    expect(restores).toHaveLength(1);
    expect(restores[0].capacity).toBe(proxyCapacity);
  });

  it("adds one restore when two prepareCluster calls overlap on getCell", async () => {
    const client = offlineTestnet();
    await cacheCluster(client);
    const tx = ccc.Transaction.from({
      inputs: [
        {
          previousOutput: { txHash: `0x${"aa".repeat(32)}`, index: 0 },
          cellOutput: { capacity: ccc.fixedPointFrom(1000), lock },
          outputData: "0x",
        },
      ],
    });
    const signer = new ccc.SignerCkbScriptReadonly(client, lock);
    const spore = { contentType: "", content: "0x", clusterId };

    // eslint-disable-next-line @typescript-eslint/unbound-method -- called with .call(this)
    const originalGetCell = ccc.CellInput.prototype.getCell;
    let entered = 0;
    let releaseWaiting: (() => void) | undefined;
    const waiting = new Promise<void>((resolve) => {
      releaseWaiting = resolve;
    });
    let releaseGate: (() => void) | undefined;
    const gate = new Promise<void>((resolve) => {
      releaseGate = resolve;
    });
    vi.spyOn(ccc.CellInput.prototype, "getCell").mockImplementation(
      async function (this: ccc.CellInput, cellClient: ccc.Client) {
        entered += 1;
        if (entered === 2) {
          releaseWaiting?.();
        }
        await gate;
        return originalGetCell.call(this, cellClient);
      },
    );

    const first = prepareCluster(signer, tx, spore, "lockProxy");
    const second = prepareCluster(signer, tx, spore, "lockProxy");
    await waiting;
    releaseGate?.();
    await Promise.all([first, second]);

    expect(
      tx.outputs.filter((output) => output.lockProxyRestoredFrom),
    ).toHaveLength(1);
  });
});
