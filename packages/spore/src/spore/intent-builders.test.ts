import { ccc, mol } from "@ckb-ccc/core";
import { describe, expect, it, vi } from "vitest";
import { createSporeCluster, transferSporeCluster } from "../cluster/index.js";
import {
  assembleCreateSporeAction,
  assembleTransferClusterAction,
  checkSporeIntent,
  injectCobuild,
  prepareSporeTransaction,
  unpackCommonCobuildProof,
} from "../cobuild/index.js";
import {
  packRawClusterData,
  packRawSporeData,
  WitnessLayout,
} from "../codec/index.js";
import { createSporeDeploymentProfile } from "../deployment/index.js";
import { withMutants } from "../mutant/index.js";
import {
  getClusterScriptInfo,
  getSporeScriptInfo,
} from "../predefined/index.js";
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
  it("rejects composition before invoking a signer if the Message is sealed", async () => {
    const f = setup();
    const prepare = vi.spyOn(f.signer, "prepareTransaction");
    const witness = WitnessLayout.encode({
      type: "SighashAll",
      value: { seal: "0x1234", message: { actions: [] } },
    });
    f.tx.setWitness(0, witness);
    const before = f.tx.toHex();
    await expect(prepareSporeTransaction(f.signer, f.tx, [])).rejects.toThrow(
      /sealed CoBuild Message/,
    );
    await expect(
      transferSpore({
        signer: f.signer,
        tx: f.tx,
        id,
        to: recipient,
        scripts: [spore],
        withIntent: false,
      }),
    ).rejects.toThrow(/sealed CoBuild Message/);
    expect(f.tx.toHex()).toBe(before);
    expect(prepare).not.toHaveBeenCalled();
  });

  it("uses the requested script info hash for both Actions in a Cluster mint", async () => {
    const f = setup();
    const scriptInfoHash = hex("ab");
    const { tx } = await createSpore({
      signer: f.signer,
      tx: f.tx,
      scriptInfo: spore,
      clusterScripts: [cluster],
      clusterMode: "clusterCell",
      scriptInfoHash,
      data: { contentType: "text/plain", content: "0x1234", clusterId: id },
    });
    const actions = await checkSporeIntent({
      client: f.client,
      scripts: { Spore: [spore], Cluster: [cluster] },
      scriptInfoHashes: [scriptInfoHash],
      tx,
    });
    expect(actions.map((action) => action.scriptInfoHash)).toEqual([
      scriptInfoHash,
      scriptInfoHash,
    ]);
  });

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
  it("keeps the required V2 Cluster Action when the V3 Spore opts out", async () => {
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
      ).toHaveLength(withIntent === false ? 1 : 2);
      expect(tx.inputs).toHaveLength(2);
      expect(tx.outputs[1].type?.eq(f.clusterCell.cellOutput.type)).toBe(true);
      expect(
        tx.cellDeps.some((dep) => dep.outPoint.eq(f.clusterCell.outPoint)),
      ).toBe(true);
      if (withIntent === false) {
        const layout = unpackCommonCobuildProof(tx.witnesses.at(-1)!);
        expect(
          layout?.type === "SighashAll" &&
            layout.value.message.actions[0].scriptHash,
        ).toBe(f.clusterCell.cellOutput.type.hash());
      }
    }
  });
  it("prepareCluster preserves the V2 Cluster Action on explicit V3 opt-out", async () => {
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
      expect(action).toBeDefined();
      expect(f.tx.inputs).toHaveLength(2);
      expect(f.tx.outputs[0].type?.eq(f.clusterCell.cellOutput.type)).toBe(
        true,
      );
    }
  });
});

const ruleIds = [hex("71"), hex("72")];
function mutantFixture(contentType = withMutants("text/plain", ruleIds)) {
  const f = setup();
  const descriptor = (byte: string) => ({
    typeId: hex(byte),
    governanceLock: lock,
    expectedDataHash: ccc.hashCkb("0x99"),
    cellDep: {
      outPoint: { txHash: hex(byte), index: 0 },
      depType: "code" as const,
    },
    cobuild: true,
  });
  const profile = createSporeDeploymentProfile({
    spore: descriptor("61"),
    cluster: descriptor("62"),
    mutant: descriptor("63"),
  });
  const codeCells = [profile.spore, profile.cluster, profile.mutant].map(
    (deployment, index) =>
      ccc.Cell.from({
        outPoint: { txHash: hex("76"), index },
        cellOutput: { capacity: 10000000000n, lock, type: deployment.codeType },
        outputData: "0x99",
      }),
  );
  const resolve = vi.fn(async function* (type: ccc.ScriptLike) {
    yield* codeCells.filter((cell) => cell.cellOutput.type?.eq(type));
  });
  f.client.findCellsByType = resolve;
  f.client.getCellLive = vi.fn(async (point: ccc.OutPointLike) =>
    codeCells.find((cell) => cell.outPoint.eq(point)),
  );
  const scriptInfo = profile.spore.scriptInfo;
  const data = {
    content: "0x77",
    contentType,
  };
  f.sporeCell.cellOutput.type = ccc.Script.from({ ...scriptInfo, args: id });
  f.sporeCell.outputData = ccc.hexFrom(packRawSporeData(data));
  const elf = new Uint8Array(64);
  elf.set([0x7f, 0x45, 0x4c, 0x46, 2, 1, 1]);
  elf[16] = 2;
  elf[18] = 243;
  const rules = ruleIds.map((args, index) =>
    ccc.Cell.from({
      outPoint: { txHash: hex("73"), index },
      cellOutput: { lock, type: { ...profile.mutant.scriptInfo, args } },
      outputData: elf,
    }),
  );
  const historicDeps: ccc.Cell[] = [];
  const getCell = f.client.getCell.bind(f.client);
  f.client.getCell = vi.fn(
    async (point: ccc.OutPointLike) =>
      [...codeCells, ...rules, ...historicDeps].find((cell) =>
        cell.outPoint.eq(point),
      ) ?? getCell(point),
  );
  const lookup = vi.fn(async function* (key: ccc.ClientIndexerSearchKeyLike) {
    expect(key.script.codeHash).toBe(profile.mutant.scriptInfo.codeHash);
    yield* rules;
  });
  f.client.findCells = lookup;
  const build = (op: "create" | "transfer" | "melt") => {
    const base = { signer: f.signer, tx: f.tx, withIntent: false };
    if (op === "create") {
      return createSpore({ ...base, scriptInfo, data });
    }
    const scripts = [getSporeScriptInfo(f.client), scriptInfo];
    if (op === "transfer") {
      return transferSpore({ ...base, scripts, id, to: recipient });
    }
    return meltSpore({ ...base, scripts, id });
  };
  return {
    ...f,
    profile,
    rules,
    data,
    lookup,
    build,
    codeCells,
    resolve,
    historicDeps,
  };
}

function reviewedClusterMint(reuseCluster: boolean) {
  const f = mutantFixture();
  const clusterScript = f.profile.cluster.scriptInfo;
  f.clusterCell.cellOutput.type = ccc.Script.from({
    ...clusterScript,
    args: id,
  });
  const action = assembleTransferClusterAction(
    f.clusterCell.cellOutput,
    f.clusterCell.cellOutput,
  );
  if (reuseCluster) {
    f.tx.addInput(f.clusterCell);
    f.tx.addOutput(f.clusterCell.cellOutput, f.clusterCell.outputData);
    f.tx.addCellDeps({ outPoint: f.clusterCell.outPoint, depType: "code" });
    injectCobuild(f.tx, [action]);
  }
  const mint = (clusterMode: "clusterCell" | "lockProxy" = "clusterCell") =>
    createSpore({
      signer: f.signer,
      tx: f.tx,
      scriptInfo: spore,
      clusterScripts: [clusterScript],
      clusterMode,
      withIntent: false,
      data: { clusterId: id, contentType: "text/plain", content: "0x77" },
    });
  return { ...f, action, mint };
}

describe("Spore mint with a reviewed Cluster deployment", () => {
  it.each(["code", "depGroup"] as const)(
    "rejects stale reviewed code in a %s after a successor is published",
    async (depType) => {
      const f = reviewedClusterMint(true);
      const predecessor = f.codeCells[1].clone();
      f.historicDeps.push(predecessor);
      f.codeCells[1] = ccc.Cell.from({
        ...predecessor,
        outPoint: { txHash: hex("77"), index: 2 },
      });
      const group = ccc.Cell.from({
        outPoint: { txHash: hex("78"), index: 0 },
        cellOutput: { capacity: 100000000000n, lock },
        outputData: mol.vector(ccc.OutPoint).encode([predecessor.outPoint]),
      });
      f.historicDeps.push(group);
      const old = depType === "code" ? predecessor : group;
      f.tx.addCellDeps({ outPoint: old.outPoint, depType });
      const before = f.tx.toHex();
      await expect(f.mint()).rejects.toThrow(/Stale reviewed code dependency/);
      expect(f.tx.toHex()).toBe(before);

      f.tx.cellDeps = f.tx.cellDeps.filter(
        (dep) => !dep.outPoint.eq(old.outPoint),
      );
      const { tx } = await f.mint();
      expect(
        tx.cellDeps.some((dep) => dep.outPoint.eq(f.codeCells[1].outPoint)),
      ).toBe(true);
      expect(tx.cellDeps.some((dep) => dep.outPoint.eq(old.outPoint))).toBe(
        false,
      );
    },
  );

  it("preserves a dep group already supplying the approved executable", async () => {
    const f = reviewedClusterMint(true);
    const live = f.codeCells[1].outPoint;
    const group = ccc.Cell.from({
      outPoint: { txHash: hex("78"), index: 0 },
      cellOutput: { capacity: 100000000000n, lock },
      outputData: mol.vector(ccc.OutPoint).encode([live]),
    });
    f.historicDeps.push(group);
    f.tx.addCellDeps({ outPoint: group.outPoint, depType: "depGroup" });
    const { tx } = await f.mint();
    expect(tx.cellDeps.some((dep) => dep.outPoint.eq(group.outPoint))).toBe(
      true,
    );
    expect(tx.cellDeps.some((dep) => dep.outPoint.eq(live))).toBe(false);
  });

  it("checks reviewed Cluster code if lock proxy reuses the Cluster input", async () => {
    const f = reviewedClusterMint(true);
    const approved = f.codeCells[1];
    const before = f.tx.toHex();
    f.codeCells[1] = ccc.Cell.from({ ...approved, outputData: "0x00" });
    await expect(f.mint("lockProxy")).rejects.toThrow(/binary pin/);
    expect(f.tx.toHex()).toBe(before);

    f.codeCells[1] = approved;
    const { tx } = await f.mint("lockProxy");
    expect(tx.cellDeps.some((dep) => dep.outPoint.eq(approved.outPoint))).toBe(
      true,
    );
    expect(f.tx.toHex()).toBe(before);
  });

  it.each([false, true])(
    "checks a preassembled Cluster and includes its live code once (already present: %s)",
    async (hasCodeDep) => {
      const f = reviewedClusterMint(true);
      const live = f.codeCells[1].outPoint;
      if (hasCodeDep) {
        f.tx.addCellDeps({ outPoint: live, depType: "code" });
      } else {
        f.tx.cellDeps = [];
      }
      const before = f.tx.toHex();
      const { tx } = await f.mint();
      expect(f.resolve).toHaveBeenCalledWith(f.profile.cluster.codeType, false);
      expect(tx.inputs.map((input) => input.previousOutput.toHex())).toEqual(
        f.tx.inputs.map((input) => input.previousOutput.toHex()),
      );
      expect(tx.outputs).toHaveLength(2);
      expect(tx.outputs[0].toHex()).toBe(f.tx.outputs[0].toHex());
      expect(tx.outputsData[0]).toBe(f.tx.outputsData[0]);
      expect(tx.cellDeps.map((dep) => dep.outPoint.toHex()).sort()).toEqual(
        [f.clusterCell.outPoint, live]
          .map((outPoint) => outPoint.toHex())
          .sort(),
      );
      const proof = unpackCommonCobuildProof(tx.witnesses.at(-1)!);
      expect(
        proof?.type === "SighashAll" && proof.value.message.actions,
      ).toEqual([f.action]);
      expect(f.tx.toHex()).toBe(before);
    },
  );

  it.each([
    [false, "binary pin"],
    [true, "binary pin"],
    [true, "governance Lock"],
  ])(
    "keeps a transaction unchanged (preassembled: %s) when Cluster code fails the %s check",
    async (reuseCluster, mismatch) => {
      const f = reviewedClusterMint(reuseCluster);
      const approved = f.codeCells[1];
      const replacement = approved.clone();
      if (mismatch === "binary pin") {
        replacement.outputData = "0x98";
      } else {
        replacement.cellOutput.lock = recipient;
      }
      f.codeCells[1] = replacement;
      const before = f.tx.toHex();
      await expect(f.mint()).rejects.toThrow(mismatch);
      expect(f.tx.toHex()).toBe(before);

      f.codeCells[1] = approved;
      const { tx } = await f.mint();
      expect(tx.outputs).toHaveLength(2);
      expect(tx.inputs).toHaveLength(2);
      expect(f.tx.toHex()).toBe(before);
    },
  );
});

describe("profile-bound native Mutants in Spore builders", () => {
  it("uses the live pinned Cluster code Cell and attaches the rule on mint", async () => {
    const f = mutantFixture();
    const getCellDeps = vi.spyOn(f.client, "getCellDeps");
    const { tx } = await createSporeCluster({
      signer: f.signer,
      tx: f.tx,
      scriptInfo: f.profile.cluster.scriptInfo,
      data: { name: "Native", description: "", mutantId: ruleIds[0] },
      withIntent: false,
    });
    expect(tx.cellDeps.map((dep) => dep.outPoint.toHex())).toEqual(
      [f.rules[0], f.codeCells[1]].map((cell) => cell.outPoint.toHex()),
    );
    expect(f.resolve).toHaveBeenCalledExactlyOnceWith(
      f.profile.cluster.codeType,
      false,
    );
    expect(getCellDeps).not.toHaveBeenCalled();
  });

  it.each(["bytecode", "governance Lock"] as const)(
    "rejects a successor with changed %s before signing",
    async (change) => {
      const f = mutantFixture();
      const code = f.codeCells[0].clone();
      if (change === "bytecode") {
        code.outputData = "0x98";
      } else {
        code.cellOutput.lock = recipient;
      }
      f.codeCells[0] = code;
      const before = f.tx.toHex();
      await expect(f.build("create")).rejects.toThrow(
        change === "bytecode" ? /binary pin/ : /governance Lock/,
      );
      expect(f.tx.toHex()).toBe(before);
    },
  );

  it.each(["transfer", "melt"] as const)(
    "%s accepts an existing Spore with an escaped line feed and no Mutants",
    async (op) => {
      const f = mutantFixture('text/plain;note="first\\\nsecond"');
      const { tx } = await f.build(op);
      expect(
        tx.inputs.some((input) =>
          input.previousOutput.eq(f.sporeCell.outPoint),
        ),
      ).toBe(true);
      expect(tx.outputsData).toEqual(
        op === "transfer" ? [f.sporeCell.outputData] : [],
      );
      expect(f.lookup).not.toHaveBeenCalled();
    },
  );

  it.each(["create", "transfer", "melt"] as const)(
    "%s includes every rule once and permits retry after lookup failure",
    async (op) => {
      const f = mutantFixture();
      const second = f.rules.pop()!;
      f.tx.addCellDeps({ outPoint: f.rules[0].outPoint, depType: "code" });
      const before = f.tx.toHex();
      await expect(f.build(op)).rejects.toThrow(/not found/);
      expect(f.tx.toHex()).toBe(before);
      f.rules.push(second);
      const { tx } = await f.build(op);
      expect(tx.cellDeps.map((dep) => dep.outPoint.toHex())).toEqual(
        [...f.rules, f.codeCells[0]].map((cell) => cell.outPoint.toHex()),
      );
      expect(f.tx.toHex()).toBe(before);
    },
  );

  it.each(["ambiguous", "malformed ELF", "duplicate ID"] as const)(
    "rejects %s without changing the input transaction",
    async (failure) => {
      const f = mutantFixture();
      if (failure === "ambiguous") {
        const duplicate = f.rules[1].clone();
        duplicate.outPoint.index = 8n;
        f.rules.push(duplicate);
      } else if (failure === "malformed ELF") {
        f.rules[1].outputData = "0x12";
      } else {
        f.data.contentType += "," + ruleIds[0].slice(2);
      }
      const before = f.tx.toHex();
      await expect(f.build("create")).rejects.toThrow(
        failure === "ambiguous"
          ? /Ambiguous/
          : failure === "malformed ELF"
            ? /bytes/
            : /Duplicate/,
      );
      expect(f.tx.toHex()).toBe(before);
    },
  );

  it("leaves native-looking MIME on legacy and unpaired custom scripts to their own rules", async () => {
    const f = mutantFixture();
    for (const scriptInfo of [getSporeScriptInfo(f.client), spore]) {
      f.sporeCell.cellOutput.type = ccc.Script.from({
        ...scriptInfo,
        args: id,
      });
      const { tx } = await transferSpore({
        signer: f.signer,
        scripts: [f.profile.spore.scriptInfo, scriptInfo],
        id,
        to: recipient,
      });
      expect(tx.outputsData[0]).toBe(f.sporeCell.outputData);
      expect(f.lookup).not.toHaveBeenCalled();
    }
  });
});
