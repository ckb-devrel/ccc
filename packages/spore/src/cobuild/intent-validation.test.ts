import { ccc, mol } from "@ckb-ccc/core";
import { describe, expect, it, vi } from "vitest";
import { SporeAction, WitnessLayout } from "../codec/index.js";
import {
  DEFAULT_COBUILD_INFO_HASH,
  getSporeScriptInfo,
} from "../predefined/index.js";
import {
  checkSporeIntent,
  injectCobuild,
  SporeIntentCategory,
  SporeIntentScripts,
} from "./index.js";

const hex = (byte: string) => ccc.hexFrom(byte.repeat(32));
const lock = (byte: string) =>
  ccc.Script.from({ codeHash: hex(byte), hashType: "type", args: "0x" });
const alice = lock("11"),
  bob = lock("22"),
  mallory = lock("ff");
const id = hex("33"),
  proxyId = hex("44");
const outPoint = ccc.OutPoint.from({ txHash: hex("55"), index: 0 });
const proxyPoint = ccc.OutPoint.from({ txHash: hex("66"), index: 0 });
const scripts: SporeIntentScripts = Object.fromEntries(
  ["Spore", "Cluster", "ClusterProxy", "ClusterAgent"].map(
    (category, index) => [
      category,
      [
        {
          codeHash: hex((index + 10).toString(16).repeat(2)),
          hashType: "data2",
          cellDeps: [],
        },
      ],
    ],
  ),
);
type Kind = ccc.DecodedType<typeof SporeAction>["type"];
const kinds: Kind[] = [
  "CreateSpore",
  "TransferSpore",
  "MeltSpore",
  "CreateCluster",
  "TransferCluster",
  "CreateClusterProxy",
  "TransferClusterProxy",
  "MeltClusterProxy",
  "CreateClusterAgent",
  "TransferClusterAgent",
  "MeltClusterAgent",
];
type Value = ccc.DecodedType<typeof SporeAction>["value"];
const address = (script: ccc.Script) => ({
  type: "Script" as const,
  value: script,
});

function fixture(kind: Kind, paid = false) {
  const category = kind.replace(
    /^(Create|Transfer|Melt)/,
    "",
  ) as SporeIntentCategory;
  const create = kind.startsWith("Create"),
    melt = kind.startsWith("Melt");
  const proxyType = ccc.Script.from({
    ...scripts.ClusterProxy![0],
    args: proxyId + (paid ? "0100000000000000" : ""),
  });
  const type = ccc.Script.from({
    ...scripts[category]![0],
    args: category === "ClusterProxy" ? proxyType.args : id,
  });
  const data =
    category === "ClusterProxy"
      ? id
      : category === "ClusterAgent"
        ? proxyType.hash()
        : "0x1234";
  const capacity = 100000000000n;
  const cell = ccc.Cell.from({
    outPoint,
    cellOutput: { capacity, lock: alice, type: create ? undefined : type },
    outputData: create ? "0x" : data,
  });
  const proxy = ccc.Cell.from({
    outPoint: proxyPoint,
    cellOutput: { capacity, lock: alice, type: proxyType },
    outputData: id,
  });
  const getCell = vi.fn(async (point: ccc.OutPointLike) =>
    ccc.OutPoint.from(point).eq(outPoint)
      ? cell
      : ccc.OutPoint.from(point).eq(proxyPoint)
        ? proxy
        : undefined,
  );
  const client = { addressPrefix: "ckt", getCell } as unknown as ccc.Client;
  const tx = ccc.Transaction.from({
    inputs: [{ previousOutput: outPoint }],
    outputs: melt ? [] : [{ capacity, lock: bob, type }],
    outputsData: melt ? [] : [data],
    cellDeps:
      category === "ClusterAgent" && create
        ? [{ outPoint: proxyPoint, depType: "code" }]
        : [],
  });
  const value = {
    ...(category === "Spore" ? { sporeId: id } : { clusterId: id }),
    ...(category === "ClusterProxy" || kind === "CreateClusterAgent"
      ? { clusterProxyId: proxyId }
      : {}),
    ...(!create ? { from: address(alice) } : {}),
    ...(!melt ? { to: address(bob) } : {}),
    ...(create && (category === "Spore" || category === "Cluster")
      ? { dataHash: ccc.hashCkb(data) }
      : {}),
  } as Value;
  const makeAction = (changed: Value = value, changedKind: Kind = kind) => ({
    scriptInfoHash: DEFAULT_COBUILD_INFO_HASH,
    scriptHash: type.hash(),
    data: ccc.hexFrom(
      SporeAction.encode({
        type: changedKind,
        value: changed,
      } as ccc.EncodableType<typeof SporeAction>),
    ),
  });
  const action = makeAction();
  injectCobuild(tx, [action]);
  const check = () => checkSporeIntent({ client, tx, scripts });
  const setAction = (next: ReturnType<typeof makeAction>) => {
    tx.witnesses = [];
    injectCobuild(tx, [next]);
  };
  return {
    client,
    getCell,
    tx,
    type,
    cell,
    proxy,
    value,
    action,
    makeAction,
    setAction,
    check,
  };
}

describe("verified Spore intent", () => {
  it.each(kinds)(
    "accepts truthful %s without changing the transaction",
    async (kind) => {
      const f = fixture(kind),
        before = f.tx.toHex();
      expect(await f.check()).toEqual([f.action]);
      expect(f.tx.toHex()).toBe(before);
    },
  );
  it.each(kinds.filter((kind) => !kind.startsWith("Melt")))(
    "rejects forged %s recipient",
    async (kind) => {
      const f = fixture(kind);
      f.setAction(f.makeAction({ ...f.value, to: address(mallory) }));
      await expect(f.check()).rejects.toThrow(/to mismatch/);
    },
  );
  it.each(kinds.filter((kind) => !kind.startsWith("Create")))(
    "rejects forged %s sender",
    async (kind) => {
      const f = fixture(kind);
      f.setAction(f.makeAction({ ...f.value, from: address(mallory) }));
      await expect(f.check()).rejects.toThrow(/from mismatch/);
    },
  );
  it.each(kinds)("rejects misleading %s IDs", async (kind) => {
    const f = fixture(kind);
    const key = kind.endsWith("Spore")
      ? "sporeId"
      : kind.endsWith("Proxy")
        ? "clusterProxyId"
        : "clusterId";
    f.setAction(f.makeAction({ ...f.value, [key]: hex("ff") }));
    await expect(f.check()).rejects.toThrow(/ID mismatch/);
  });
  it.each(kinds)("rejects wrong %s operation shape", async (kind) => {
    const f = fixture(kind);
    if (kind.startsWith("Create")) {
      f.cell.cellOutput.type = f.type;
    } else if (kind.startsWith("Transfer")) {
      f.cell.cellOutput.type = undefined;
    } else {
      f.tx.addOutput({ ...f.cell.cellOutput, lock: bob }, f.cell.outputData);
    }
    await expect(f.check()).rejects.toThrow(/requires/);
  });
  it.each(kinds.filter((kind) => kind.startsWith("Transfer")))(
    "rejects %s data modification",
    async (kind) => {
      const f = fixture(kind);
      f.tx.outputsData[0] = "0xab";
      await expect(f.check()).rejects.toThrow(/immutable data/);
    },
  );
  it.each([
    "CreateSpore",
    "TransferSpore",
    "MeltSpore",
    "CreateCluster",
    "TransferCluster",
  ] as const)("preserves contract-valid %s ID suffixes", async (kind) => {
    const f = fixture(kind);
    f.type.args = ccc.hexFrom(f.type.args + "01");
    f.setAction(f.makeAction());
    expect(await f.check()).toHaveLength(1);
  });
  it.each(["Spore", "Cluster"] as const)(
    "allows an unacted %s with an ID suffix in a mixed transaction",
    async (category) => {
      const f = fixture("TransferSpore");
      f.tx.addOutput(
        {
          capacity: 100000000000n,
          lock: bob,
          type: { ...scripts[category]![0], args: hex("99") + "01" },
        },
        "0x1234",
      );
      expect(await f.check()).toEqual([f.action]);
    },
  );
  it.each([
    "CreateSpore",
    "CreateCluster",
    "CreateClusterProxy",
    "CreateClusterAgent",
  ] as const)("rejects invalid %s argument lengths", async (kind) => {
    const f = fixture(kind);
    f.type.args =
      kind === "CreateSpore" || kind === "CreateCluster"
        ? "0x01"
        : ccc.hexFrom(f.type.args + "01");
    f.setAction(f.makeAction());
    await expect(f.check()).rejects.toThrow(/ID length/);
  });
  it.each([
    "CreateClusterProxy",
    "TransferClusterProxy",
    "MeltClusterProxy",
  ] as const)("accepts paid %s", async (kind) => {
    const f = fixture(kind, true);
    expect(await f.check()).toHaveLength(1);
  });
  it.each([false, true])(
    "resolves Agent creation's Proxy ID (paid=%s)",
    async (paid) => {
      const f = fixture("CreateClusterAgent", paid);
      expect(await f.check()).toHaveLength(1);
      f.setAction(f.makeAction({ ...f.value, clusterProxyId: hex("ff") }));
      await expect(f.check()).rejects.toThrow(/Proxy ID mismatch/);
    },
  );
  it("resolves an Agent Proxy through a depGroup", async () => {
    const f = fixture("CreateClusterAgent", true);
    const groupPoint = ccc.OutPoint.from({ txHash: hex("77"), index: 0 });
    const group = ccc.Cell.from({
      ...f.proxy,
      outPoint: groupPoint,
      outputData: ccc.hexFrom(mol.vector(ccc.OutPoint).encode([proxyPoint])),
    });
    const original = f.getCell.getMockImplementation()!;
    f.getCell.mockImplementation(async (point) =>
      ccc.OutPoint.from(point).eq(groupPoint) ? group : original(point),
    );
    f.tx.cellDeps = [
      ccc.CellDep.from({ outPoint: groupPoint, depType: "depGroup" }),
    ];
    expect(await f.check()).toHaveLength(1);
  });
  it("rejects missing or unrecognized Agent Proxy dependencies", async () => {
    const f = fixture("CreateClusterAgent");
    f.tx.cellDeps = [];
    await expect(f.check()).rejects.toThrow(/Proxy dependency missing/);
    f.tx.cellDeps = [
      ccc.CellDep.from({ outPoint: proxyPoint, depType: "code" }),
    ];
    await expect(
      checkSporeIntent({
        client: f.client,
        tx: f.tx,
        scripts: { ClusterAgent: scripts.ClusterAgent },
      }),
    ).rejects.toThrow(/unrecognized Proxy/);
  });
  it("rejects unmatched Spore hashes and fake metadata identities", async () => {
    const f = fixture("TransferSpore");
    f.setAction({ ...f.action, scriptHash: hex("ff") });
    await expect(f.check()).rejects.toThrow(/script hash/);
    f.setAction({ ...f.action, scriptInfoHash: hex("ff") });
    await expect(f.check()).rejects.toThrow(/script info hash/);
  });
  it("excludes foreign Actions from verified results without removing them", async () => {
    const f = fixture("TransferSpore");
    const foreign = {
      ...f.action,
      scriptHash: hex("ff"),
      scriptInfoHash: hex("ee"),
      data: "0x1234",
    };
    f.tx.witnesses = [];
    injectCobuild(f.tx, [foreign, f.action]);
    const before = f.tx.toHex();
    expect(await f.check()).toEqual([f.action]);
    expect(f.tx.toHex()).toBe(before);
    f.tx.witnesses = [];
    injectCobuild(f.tx, [{ ...foreign, data: f.action.data }]);
    expect(await f.check()).toEqual([]); // dual-hash spoofing cannot enter verified results
  });
  it("binds category and hash type as well as code hash", async () => {
    const f = fixture("TransferSpore");
    f.setAction(
      f.makeAction(
        { clusterId: id, from: address(alice), to: address(bob) },
        "TransferCluster",
      ),
    );
    await expect(f.check()).rejects.toThrow(/category mismatch/);
    const wrongType = {
      Spore: [{ ...scripts.Spore![0], hashType: "data1" as const }],
    };
    f.setAction(f.action);
    await expect(
      checkSporeIntent({ client: f.client, tx: f.tx, scripts: wrongType }),
    ).rejects.toThrow(/deployment/);
  });
  it("supports custom metadata hashes only when explicitly trusted", async () => {
    const f = fixture("TransferSpore"),
      custom = hex("ee");
    f.setAction({ ...f.action, scriptInfoHash: custom });
    expect(
      await checkSporeIntent({
        client: f.client,
        tx: f.tx,
        scripts,
        scriptInfoHashes: [custom],
      }),
    ).toHaveLength(1);
  });
  it("keeps existing Spore presets recognized by default", async () => {
    const f = fixture("CreateSpore"),
      info = getSporeScriptInfo(f.client);
    f.tx.outputs[0].type = ccc.Script.from({ ...info, args: id });
    f.setAction({ ...f.action, scriptHash: f.tx.outputs[0].type.hash() });
    expect(await checkSporeIntent({ client: f.client, tx: f.tx })).toHaveLength(
      1,
    );
  });
  it("rejects duplicate Actions and ambiguous configured categories", async () => {
    const f = fixture("TransferSpore");
    f.tx.witnesses = [];
    injectCobuild(f.tx, [f.action, f.action]);
    await expect(f.check()).rejects.toThrow(/Duplicated CoBuild action/);
    f.setAction(f.action);
    await expect(
      checkSporeIntent({
        client: f.client,
        tx: f.tx,
        scripts: { ...scripts, Cluster: scripts.Spore },
      }),
    ).rejects.toThrow(/Ambiguous/);
  });
  it("rejects unresolved inputs and duplicate known-family cell sides", async () => {
    const f = fixture("TransferSpore");
    f.getCell.mockResolvedValue(undefined);
    await expect(f.check()).rejects.toThrow(/Input cell not found/);
    f.getCell.mockResolvedValue(f.cell);
    f.tx.inputs.push(f.tx.inputs[0]);
    await expect(f.check()).rejects.toThrow(/Multiple Spore input/);
    f.tx.inputs.pop();
    f.tx.addOutput(f.tx.outputs[0], f.tx.outputsData[0]);
    await expect(f.check()).rejects.toThrow(/Multiple Spore output/);
  });
  it("finds Messages before a trailing ordinary witness and rejects duplicate Messages", async () => {
    const f = fixture("TransferSpore");
    f.setAction(f.makeAction({ ...f.value, to: address(mallory) }));
    f.tx.witnesses.push("0x");
    await expect(f.check()).rejects.toThrow(/to mismatch/);
    f.setAction(f.action);
    f.tx.witnesses.push(f.tx.witnesses.at(-1)!);
    await expect(f.check()).rejects.toThrow(/Duplicated CoBuild Message/);
  });
  it("allows ordinary lock witnesses and SighashAllOnly but rejects malformed tags", async () => {
    const f = fixture("TransferSpore");
    f.tx.witnesses[0] = ccc.hexFrom(
      WitnessLayout.encode({
        type: "SighashAllOnly",
        value: { seal: "0x1234" },
      }),
    );
    expect(await f.check()).toHaveLength(1);
    f.tx.witnesses[0] = "0x010000ff";
    await expect(f.check()).rejects.toThrow(/Malformed.*index 0/);
  });
});
