import { ccc } from "@ckb-ccc/core";
import { beforeEach, describe, expect, it, Mock, vi } from "vitest";
import { DidCkbData } from "./codec.js";
import { argsToDid } from "./identifier.js";
import {
  findDidCkbCell,
  listDidCkbsByLock,
  resolveDidCkb,
} from "./resolver.js";

describe("resolver", () => {
  let client: ccc.Client;

  const codeHash =
    "0x510150477b10d6ab551a509b71265f3164e9fd4137fcb5a4322f49f03092c7c5";
  const id = ("0x" + "ab".repeat(20)) as ccc.Hex;
  const did = argsToDid(id);

  const sampleData = DidCkbData.fromV1({
    document: { hello: "world" },
    localId: undefined,
  });

  function fakeCell(args: ccc.Hex = id, data = sampleData): ccc.Cell {
    return ccc.Cell.from({
      outPoint: {
        txHash:
          "0x1111111111111111111111111111111111111111111111111111111111111111",
        index: 0,
      },
      cellOutput: {
        capacity: ccc.fixedPointFrom(300),
        lock: ccc.Script.from({
          codeHash: "0x" + "0".repeat(64),
          hashType: "type",
          args: "0xdeadbeef",
        }),
        type: ccc.Script.from({
          codeHash,
          hashType: "type",
          args,
        }),
      },
      outputData: ccc.hexFrom(data.toBytes()),
    });
  }

  beforeEach(() => {
    client = {
      getKnownScript: vi.fn(),
      findSingletonCellByType: vi.fn(),
      findCells: vi.fn(),
    } as unknown as ccc.Client;

    (client.getKnownScript as Mock).mockResolvedValue({
      codeHash,
      hashType: "type",
      cellDeps: [],
    });
  });

  it("findDidCkbCell returns a decoded record when a live cell exists", async () => {
    (client.findSingletonCellByType as Mock).mockResolvedValue(fakeCell());

    const record = await findDidCkbCell({ client, id });
    expect(record?.did).toBe(did);
    expect(record?.id).toBe(id);
    expect(record?.data.value.document).toEqual({ hello: "world" });
  });

  it("findDidCkbCell returns undefined when no live cell exists", async () => {
    (client.findSingletonCellByType as Mock).mockResolvedValue(undefined);
    expect(await findDidCkbCell({ client, id })).toBeUndefined();
  });

  it("resolveDidCkb rejects non-did:ckb strings", async () => {
    await expect(
      resolveDidCkb({ client, did: "did:plc:abc" }),
    ).rejects.toThrow();
  });

  it("resolveDidCkb resolves the same record as findDidCkbCell", async () => {
    (client.findSingletonCellByType as Mock).mockResolvedValue(fakeCell());
    const record = await resolveDidCkb({ client, did });
    expect(record?.did).toBe(did);
  });

  it("listDidCkbsByLock decodes every cell yielded by findCells", async () => {
    const other = ("0x" + "cd".repeat(20)) as ccc.Hex;
    (client.findCells as Mock).mockImplementation(async function* () {
      yield fakeCell(id);
      yield fakeCell(other);
    });

    const lock = ccc.Script.from({
      codeHash: "0x" + "0".repeat(64),
      hashType: "type",
      args: "0xdeadbeef",
    });

    const records = await listDidCkbsByLock({ client, lock });
    expect(records.map((r) => r.id)).toEqual([id, other]);
    expect(records.map((r) => r.did)).toEqual([did, argsToDid(other)]);
  });

  it("listDidCkbsByLock skips cells without a type script", async () => {
    const cellWithoutType = ccc.Cell.from({
      outPoint: {
        txHash:
          "0x2222222222222222222222222222222222222222222222222222222222222222",
        index: 0,
      },
      cellOutput: {
        capacity: ccc.fixedPointFrom(100),
        lock: ccc.Script.from({
          codeHash: "0x" + "0".repeat(64),
          hashType: "type",
          args: "0x",
        }),
      },
      outputData: "0x",
    });
    (client.findCells as Mock).mockImplementation(async function* () {
      yield cellWithoutType;
      yield fakeCell(id);
    });

    const lock = ccc.Script.from({
      codeHash: "0x" + "0".repeat(64),
      hashType: "type",
      args: "0xdeadbeef",
    });

    const records = await listDidCkbsByLock({ client, lock });
    expect(records.length).toBe(1);
    expect(records[0].id).toBe(id);
  });
});
