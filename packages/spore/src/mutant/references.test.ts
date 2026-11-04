import { ccc } from "@ckb-ccc/core";
import { describe, expect, it, vi } from "vitest";
import {
  buildMutantArgs,
  checkMutantPayments,
  createMutant,
  findMutant,
  getMutantIds,
  injectMutantReferences,
  withMutants,
} from "./index.js";

const hex = (byte: string) => ccc.hexFrom(byte.repeat(32));
const id = hex("ab"),
  secondId = hex("cd");
const info = { codeHash: hex("11"), hashType: "data2" as const, cellDeps: [] };
const lock = ccc.Script.from({
  codeHash: hex("22"),
  hashType: "type",
  args: "0x",
});
const point = (index: number) =>
  ccc.OutPoint.from({ txHash: hex("33"), index });
const cell = (args = id, index = 0) =>
  ccc.Cell.from({
    outPoint: point(index),
    cellOutput: { capacity: 100000000000n, lock, type: { ...info, args } },
    outputData: "0x",
  });
function clientFor(cells: ccc.Cell[]) {
  return {
    addressPrefix: "ckt",
    findCells: vi.fn(async function* (search: ccc.ClientIndexerSearchKeyLike) {
      expect(search.scriptSearchMode).toBe("prefix");
      expect(search.withData).toBe(true);
      yield* cells; // even an overbroad response must be checked locally
    }),
    getCell: vi.fn(async (outPoint: ccc.OutPointLike) =>
      cells.find((c) => c.outPoint.eq(outPoint)),
    ),
    getCellDeps: vi.fn(async () => []),
  } as unknown as ccc.Client;
}

describe("native Mutant references", () => {
  it.each([undefined, 0n, 100n])(
    "looks up and injects a rule with payment %s",
    async (payment) => {
      const rule = cell(buildMutantArgs(id, payment)),
        client = clientFor([rule]);
      expect((await findMutant(client, id, [info]))?.cell).toBe(rule);
      const tx = ccc.Transaction.from({});
      await injectMutantReferences({
        client,
        tx,
        mutantIds: [id],
        scripts: [info],
      });
      expect(tx.cellDeps[0].outPoint.eq(rule.outPoint)).toBe(true);
      expect(tx.cellDeps[0].depType).toBe("code");
    },
  );
  it("ignores malformed lengths, wrong IDs and different deployment identities", async () => {
    const wrongHash = cell();
    wrongHash.cellOutput.type!.codeHash = hex("ff");
    const wrongType = cell();
    wrongType.cellOutput.type!.hashType = "data1";
    const good = cell(buildMutantArgs(id, 10));
    const client = clientFor([
      cell(ccc.hexFrom(id + "00")),
      cell(secondId),
      wrongHash,
      wrongType,
      good,
    ]);
    expect((await findMutant(client, id, [info]))?.cell).toBe(good);
    await expect(findMutant(client, "0x12", [info])).rejects.toThrow(
      /32 bytes/,
    );
  });
  it("rejects ambiguous distinct cells but tolerates repeated identical results", async () => {
    const rule = cell(),
      client = clientFor([rule, rule]);
    expect((await findMutant(client, id, [info, info]))?.cell).toBe(rule);
    await expect(
      findMutant(clientFor([rule, cell(buildMutantArgs(id, 1), 1)]), id, [
        info,
      ]),
    ).rejects.toThrow(/Ambiguous/);
  });
  it("fails before injecting an unresolved rule", async () => {
    const tx = ccc.Transaction.from({});
    await expect(
      injectMutantReferences({
        client: clientFor([]),
        tx,
        mutantIds: [id],
        scripts: [info],
      }),
    ).rejects.toThrow(/not found/);
    expect(tx.cellDeps).toHaveLength(0);
  });
  it("constructs a paid rule and resolves its returned 32-byte ID", async () => {
    const client = clientFor([]);
    const signer = {
      client,
      getRecommendedAddressObj: async () => ({ script: lock }),
    } as unknown as ccc.Signer;
    const code = new Uint8Array(64);
    code.set([0x7f, 0x45, 0x4c, 0x46, 2, 1, 1]);
    code[16] = 2;
    code[18] = 243;
    const { tx, id: published } = await createMutant({
      signer,
      code,
      payment: 7n,
      scriptInfo: info,
      tx: { inputs: [{ previousOutput: point(9) }] },
    });
    expect(tx.outputs[0].type!.args).toBe(buildMutantArgs(published, 7n));
    const rule = ccc.Cell.from({
      outPoint: point(0),
      cellOutput: tx.outputs[0],
      outputData: tx.outputsData[0],
    });
    expect((await findMutant(clientFor([rule]), published, [info]))?.cell).toBe(
      rule,
    );
    await expect(
      createMutant({
        signer,
        code,
        scriptInfo: { ...info, hashType: "data1" },
      }),
    ).rejects.toThrow(/data2/);
  });
  it.each([-1n, 1n << 64n])("rejects payment outside uint64: %s", (payment) => {
    expect(() => buildMutantArgs(id, payment)).toThrow(/uint64/);
  });
  it("checks cumulative same-owner mint payments against net capacity", async () => {
    const rules = [
      cell(buildMutantArgs(id, 2n), 0),
      cell(buildMutantArgs(secondId, 3n), 1),
    ];
    const funding = cell(id, 2),
      client = clientFor([...rules, funding]);
    const tx = ccc.Transaction.from({
      inputs: [{ previousOutput: funding.outPoint }],
      outputs: [{ capacity: funding.cellOutput.capacity + 5n, lock }],
    });
    await expect(
      checkMutantPayments({
        client,
        tx,
        mutantOutPoints: rules.map((r) => r.outPoint),
      }),
    ).resolves.toBeUndefined();
    tx.outputs[0].capacity -= 1n;
    await expect(
      checkMutantPayments({
        client,
        tx,
        mutantOutPoints: rules.map((r) => r.outPoint),
      }),
    ).rejects.toThrow(/not enough/);
  });
});

describe("contract-compatible Mutant MIME lists", () => {
  it("collects every parameter in order, preserving unrelated parameters", () => {
    expect(
      getMutantIds(
        `text/plain;charset=utf8; mutant[]=${id.slice(2)};mutant[]=${secondId.slice(2)}`,
      ),
    ).toEqual([id, secondId]);
  });
  it("rejects duplicates across parameters, lists and hex letter case", () => {
    expect(() => withMutants("text/plain", [id, id])).toThrow(/Duplicate/);
    expect(() =>
      getMutantIds(
        `text/plain;mutant[]=${id.slice(2)},${id.slice(2).toUpperCase()}`,
      ),
    ).toThrow(/Duplicate/);
    expect(() =>
      getMutantIds(
        `text/plain;mutant[]=${id.slice(2)};mutant[]=${id.slice(2)}`,
      ),
    ).toThrow(/Duplicate/);
  });
  it.each([
    "mutant[]=",
    "mutant[]=x",
    `mutant[]=${id.slice(2)},`,
    `mutant[]= ${id.slice(2)}`,
    `mutant[]=${id.slice(2)}, ${secondId.slice(2)}`,
    `mutant[]="${id.slice(2)}"`,
    `mutant[] =${id.slice(2)}`,
  ])("rejects malformed parameter %s", (parameter) => {
    expect(() => getMutantIds(`text/plain;${parameter}`)).toThrow();
  });
  it("keeps quoted unrelated values and handles trailing OWS/semicolon", () => {
    expect(
      getMutantIds(
        `text/plain;note="mutant[]=anything";mutant[]=${id.slice(2)} \t;`,
      ),
    ).toEqual([id]);
    expect(
      getMutantIds(withMutants('text/plain;note="mutant[]";', [id])),
    ).toEqual([id]);
  });
});
