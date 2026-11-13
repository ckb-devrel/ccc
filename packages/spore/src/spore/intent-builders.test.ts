import { ccc } from "@ckb-ccc/core";
import { describe, expect, it, vi } from "vitest";
import { createSporeCluster, transferSporeCluster } from "../cluster/index.js";
import {
  assembleCreateSporeAction,
  checkSporeIntent,
  injectCobuild,
  prepareSporeTransaction,
  unpackCommonCobuildProof,
} from "../cobuild/index.js";
import { packRawClusterData, packRawSporeData } from "../codec/index.js";
import { getClusterScriptInfo } from "../predefined/index.js";
import { prepareCluster } from "./advanced.js";
import { createSpore, meltSpore, transferSpore } from "./index.js";

const hex = (byte: string) => ccc.hexFrom(byte.repeat(32));
const id = hex("33");
const lock = ccc.Script.from({
  codeHash: hex("11"),
  hashType: "type",
  args: "0x",
});
const recipient = ccc.Script.from({ ...lock, args: "0x01" });
const spore = {
  codeHash: hex("aa"),
  hashType: "type" as const,
  cellDeps: [],
  cobuild: true,
};
const cluster = {
  codeHash: hex("bb"),
  hashType: "type" as const,
  cellDeps: [],
  cobuild: true,
};
function setup() {
  const funding = ccc.Cell.from({
    outPoint: { txHash: hex("22"), index: 0 },
    cellOutput: { capacity: 100000000000n, lock },
    outputData: "0x",
  });
  const sporeCell = ccc.Cell.from({
    ...funding,
    outPoint: { txHash: hex("44"), index: 0 },
    cellOutput: { ...funding.cellOutput, type: { ...spore, args: id } },
    outputData: packRawSporeData({
      contentType: "text/plain",
      content: "0x1234",
    }),
  });
  const clusterCell = ccc.Cell.from({
    ...funding,
    outPoint: { txHash: hex("55"), index: 0 },
    cellOutput: { ...funding.cellOutput, type: { ...cluster, args: id } },
    outputData: packRawClusterData({ name: "test", description: "fixture" }),
  });
  const cells = [funding, sporeCell, clusterCell];
  const client = {
    addressPrefix: "ckt",
    getCell: vi.fn(async (point: ccc.OutPointLike) =>
      cells.find((cell) => cell.outPoint.eq(point)),
    ),
    findSingletonCellByType: vi.fn(async (type: ccc.ScriptLike) =>
      cells.find((cell) => cell.cellOutput.type?.eq(type)),
    ),
    getCellDeps: vi.fn(async () => []),
  } as unknown as ccc.Client;
  const signer = {
    client,
    getRecommendedAddressObj: async () => ({ script: lock }),
    prepareTransaction: async (txLike: ccc.TransactionLike) => {
      const tx = ccc.Transaction.from(txLike);
      await tx.prepareSighashAllWitness(lock, 65, client);
      return tx;
    },
  } as unknown as ccc.Signer;
  const tx = ccc.Transaction.from({
    inputs: [{ previousOutput: funding.outPoint }],
  });
  return { signer, client, tx, sporeCell, clusterCell };
}
const operations = [
  "createSpore",
  "transferSpore",
  "meltSpore",
  "createSporeCluster",
  "transferSporeCluster",
] as const;
async function build(
  operation: (typeof operations)[number],
  withIntent?: boolean,
) {
  const f = setup(),
    base = { signer: f.signer, tx: f.tx, withIntent };
  const result =
    operation === "createSpore"
      ? await createSpore({
          ...base,
          scriptInfo: spore,
          data: { contentType: "text/plain", content: "0x1234" },
        })
      : operation === "transferSpore"
        ? await transferSpore({ ...base, scripts: [spore], id, to: recipient })
        : operation === "meltSpore"
          ? await meltSpore({ ...base, scripts: [spore], id })
          : operation === "createSporeCluster"
            ? await createSporeCluster({
                ...base,
                scriptInfo: cluster,
                data: { name: "test", description: "fixture" },
              })
            : await transferSporeCluster({
                ...base,
                scripts: [cluster],
                id,
                to: recipient,
              });
  return { ...f, tx: result.tx };
}

describe("optional intent builder compatibility", () => {
  it("forwards custom type-bound Cluster deployments during Spore creation", async () => {
    const f = setup();
    const { tx } = await createSpore({
      signer: f.signer,
      tx: f.tx,
      scriptInfo: spore,
      clusterScripts: [cluster],
      clusterMode: "clusterCell",
      withIntent: false,
      data: { contentType: "text/plain", content: "0x1234", clusterId: id },
    });
    expect(tx.inputs).toHaveLength(2);
    expect(tx.outputs[1].type?.eq(f.clusterCell.cellOutput.type!)).toBe(true);
  });
  it.each([
    [false, false],
    [false, true],
    [true, false],
    [true, true],
  ])(
    "preserves the caller on preparation failure and retry (input-slot Message: %s, new Actions: %s)",
    async (inInputSlot, withNewAction) => {
      const f = setup();
      const output = {
        capacity: 100000000000n,
        lock,
        type: { ...spore, args: id },
      };
      const tx = ccc.Transaction.from({
        inputs: inInputSlot ? [] : f.tx.inputs,
        outputs: [output],
        outputsData: ["0x"],
      });
      const existing = assembleCreateSporeAction(output, "0x");
      injectCobuild(tx, [existing]);
      if (inInputSlot) {
        tx.inputs.push(f.tx.inputs[0]);
      }
      const actions = withNewAction
        ? [
            assembleCreateSporeAction(
              { ...output, type: { ...spore, args: hex("66") } },
              "0x",
            ),
          ]
        : [];
      let attempts = 0;
      f.signer.prepareTransaction = vi.fn(
        async (txLike: ccc.TransactionLike) => {
          const prepared = ccc.Transaction.from(txLike);
          prepared.outputs[0].capacity += 1n;
          prepared.witnesses[0] = "0x1234";
          if (attempts++ === 0) {
            throw new Error("Preparation rejected");
          }
          return prepared;
        },
      );
      const before = tx.toHex();
      await expect(
        prepareSporeTransaction(f.signer, tx, actions),
      ).rejects.toThrow("Preparation rejected");
      expect(tx.toHex()).toBe(before);

      const retried = await prepareSporeTransaction(f.signer, tx, actions);
      expect(retried).not.toBe(tx);
      expect(tx.toHex()).toBe(before);
      expect(retried.outputs[0].capacity).toBe(output.capacity + 1n);
      expect(retried.witnesses[0]).toBe("0x1234");
      expect(unpackCommonCobuildProof(retried.witnesses.at(-1)!)).toEqual({
        type: "SighashAll",
        value: { seal: "0x", message: { actions: [existing, ...actions] } },
      });
    },
  );
  it.each(operations)(
    "%s preserves default Actions and opts out only explicitly",
    async (operation) => {
      for (const withIntent of [undefined, true, false]) {
        const { client, tx } = await build(operation, withIntent);
        const verified = await checkSporeIntent({
          client,
          tx,
          scripts: { Spore: [spore], Cluster: [cluster] },
        });
        expect(verified).toHaveLength(withIntent === false ? 0 : 1);
        expect(tx.getWitnessArgs(0)?.lock).toHaveLength(132); // actual lock placeholder remains
      }
    },
  );
  it("preserves an existing Action when a no-intent builder adds inputs", async () => {
    const f = setup();
    const legacy = await createSpore({
      signer: f.signer,
      tx: f.tx,
      scriptInfo: spore,
      data: { contentType: "text/plain", content: "0x" },
    });
    const before = unpackCommonCobuildProof(legacy.tx.witnesses.at(-1)!);
    const mixed = await transferSporeCluster({
      signer: f.signer,
      tx: legacy.tx,
      id,
      to: recipient,
      scripts: [cluster],
      withIntent: false,
    });
    expect(mixed.tx.witnesses.length).toBeGreaterThan(mixed.tx.inputs.length);
    expect(unpackCommonCobuildProof(mixed.tx.witnesses.at(-1)!)).toEqual(
      before,
    );
    expect(
      await checkSporeIntent({
        client: f.client,
        tx: mixed.tx,
        scripts: { Spore: [spore], Cluster: [cluster] },
      }),
    ).toHaveLength(1);
  });
  it("does not drop a preexisting Message occupying a newly appended input slot", async () => {
    const f = setup();
    const output = {
      capacity: 100000000000n,
      lock,
      type: { ...spore, args: id },
    };
    // Initially no inputs, so the Message occupies witness 0. The builder appends an input.
    const tx = ccc.Transaction.from({ outputs: [output], outputsData: ["0x"] });
    const action = assembleCreateSporeAction(output, "0x");
    injectCobuild(tx, [action]);
    const result = await transferSpore({
      signer: f.signer,
      tx,
      scripts: [spore],
      id,
      to: recipient,
      withIntent: false,
    });
    const layout = unpackCommonCobuildProof(result.tx.witnesses.at(-1)!);
    expect(layout?.type).toBe("SighashAll");
    if (layout?.type === "SighashAll") {
      expect(layout.value.message.actions).toEqual([action]);
    }
    expect(result.tx.getWitnessArgs(0)?.lock).toHaveLength(132);
  });
  it("preserves an earlier Message and existing input witnesses during composition", async () => {
    const f = setup();
    const output = {
      capacity: 100000000000n,
      lock,
      type: { ...spore, args: id },
    };
    const tx = ccc.Transaction.from({
      inputs: [{ previousOutput: f.sporeCell.outPoint }],
      outputs: [output],
      outputsData: [f.sporeCell.outputData],
    });
    const action = assembleCreateSporeAction(output, f.sporeCell.outputData);
    injectCobuild(tx, [action]);
    tx.witnesses.push("0x1234");
    const result = await transferSporeCluster({
      signer: f.signer,
      tx,
      scripts: [cluster],
      id,
      to: recipient,
      withIntent: false,
    });
    const layout = unpackCommonCobuildProof(result.tx.witnesses.at(-1)!);
    expect(layout?.type).toBe("SighashAll");
    if (layout?.type === "SighashAll") {
      expect(layout.value.message.actions).toEqual([action]);
    }
    expect(result.tx.witnesses[2]).toBe("0x1234");
    expect(result.tx.getWitnessArgs(0)?.lock).toHaveLength(132);
  });
  it("forwards opt-out through cluster-backed createSpore", async () => {
    for (const withIntent of [undefined, false]) {
      const f = setup(),
        legacyCluster = getClusterScriptInfo(f.client);
      f.clusterCell.cellOutput.type = ccc.Script.from({
        ...legacyCluster,
        args: id,
      });
      const { tx } = await createSpore({
        signer: f.signer,
        tx: f.tx,
        scriptInfo: spore,
        clusterMode: "clusterCell",
        withIntent,
        data: { contentType: "text/plain", content: "0x1234", clusterId: id },
      });
      expect(
        await checkSporeIntent({
          client: f.client,
          tx,
          scripts: { Spore: [spore] },
        }),
      ).toHaveLength(withIntent === false ? 0 : 2);
      expect(tx.inputs).toHaveLength(2);
      expect(tx.outputs[1].type?.eq(f.clusterCell.cellOutput.type)).toBe(true);
      expect(
        tx.cellDeps.some((dep) => dep.outPoint.eq(f.clusterCell.outPoint)),
      ).toBe(true);
      if (withIntent === false) {
        expect(unpackCommonCobuildProof(tx.witnesses.at(-1)!)).toBeUndefined();
      }
    }
  });
  it("prepareCluster preserves default Cluster Action and honors explicit opt-out", async () => {
    for (const withIntent of [undefined, false]) {
      const f = setup(),
        legacy = getClusterScriptInfo(f.client);
      f.clusterCell.cellOutput.type = ccc.Script.from({ ...legacy, args: id });
      const action = await prepareCluster(
        f.signer,
        f.tx,
        { clusterId: id, contentType: "text/plain", content: "0x" },
        "clusterCell",
        undefined,
        withIntent,
      );
      expect(action !== undefined).toBe(withIntent !== false);
      expect(f.tx.inputs).toHaveLength(2);
      expect(f.tx.outputs[0].type?.eq(f.clusterCell.cellOutput.type)).toBe(
        true,
      );
    }
  });
});
