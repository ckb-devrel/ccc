import { ccc } from "@ckb-ccc/ccc";
import { createElement } from "react";
import { describe, expect, it, vi } from "vitest";
import { SignerOutputSnapshot, snapshotOutput } from "../src/app/output";

describe("output snapshots", () => {
  it("preserves invalid emitted capacity without normalizing transaction or cell fields", () => {
    const lock = ccc.Script.from({
      codeHash: "0x" + "00".repeat(32),
      hashType: "type",
      args: "0x",
    });
    const output = new ccc.CellOutput(BigInt(1), lock);
    const point = new ccc.OutPoint(
      ccc.hexFrom("0x" + "11".repeat(32)),
      BigInt(0),
    );
    const cell = new ccc.Cell(point, output, "0x1234");
    const input = new ccc.CellInput(point, BigInt(0), output, "0x1234");
    const dep = new ccc.CellDep(point, "code");
    const tx = new ccc.Transaction(
      BigInt(0),
      [dep],
      [],
      [input],
      [output],
      ["0x1234"],
      ["0x"],
    );
    const [saved, savedCell, savedOutput] = snapshotOutput([
      tx,
      cell,
      output,
    ]) as [ccc.Transaction, ccc.Cell, ccc.CellOutput];
    expect(saved).toBeInstanceOf(ccc.Transaction);
    expect(saved.outputs[0].capacity).toBe(BigInt(1));
    expect(savedCell.cellOutput.capacity).toBe(BigInt(1));
    expect(savedOutput.capacity).toBe(BigInt(1));
    expect(saved.inputs[0].cellOutput).toBe(savedOutput);
    expect(saved.outputs[0]).toBe(savedOutput);
    expect(savedCell.cellOutput).toBe(savedOutput);
    expect(saved.cellDeps[0].outPoint).toBe(savedCell.outPoint);
    expect(saved.inputs[0].previousOutput).toBe(savedCell.outPoint);
    expect(savedOutput.occupiedSize).toBe(output.occupiedSize);
    output.capacity = ccc.fixedPointFrom(200);
    lock.args = "0xff";
    point.index = BigInt(3);
    tx.outputsData[0] = "0xabcd";
    expect(savedOutput.capacity).toBe(BigInt(1));
    expect(savedOutput.lock.args).toBe("0x");
    expect(savedCell.outPoint.index).toBe(BigInt(0));
    expect(saved.outputsData).toEqual(["0x1234"]);
  });
  it("contains data-class getters and preserves supported object cycles without cloning arbitrary instances", () => {
    const output = new ccc.CellOutput(
      BigInt(1),
      ccc.Script.from({
        codeHash: "0x" + "00".repeat(32),
        hashType: "type",
        args: "0x",
      }),
    );
    Object.defineProperty(output, "self", { enumerable: true, value: output });
    Object.defineProperty(output, "bad", {
      enumerable: true,
      get() {
        throw new Error("unavailable");
      },
    });
    class Custom {
      value = 1;
    }
    const custom = new Custom();
    const [saved, next] = snapshotOutput([output, custom]) as [
      ccc.CellOutput & { self: unknown; bad: unknown },
      Custom,
    ];
    expect(saved.self).toBe(saved);
    expect(saved.bad).toBeInstanceOf(Error);
    expect(saved.capacity).toBe(BigInt(1));
    expect(next).toBe(custom);
  });
  it("preserves a rendered transaction stage after later mutation", () => {
    const tx = ccc.Transaction.from({
      outputs: [
        {
          capacity: ccc.fixedPointFrom(100),
          lock: {
            codeHash: "0x" + "00".repeat(32),
            hashType: "type",
            args: "0x",
          },
        },
      ],
      outputsData: ["0x"],
    });
    const [saved] = snapshotOutput([tx]) as [ccc.Transaction];
    tx.outputs[0].capacity = BigInt(200);
    tx.outputsData[0] = "0x1234";
    expect(saved.outputs[0].capacity).toBe(ccc.fixedPointFrom(100));
    expect(saved.outputsData[0]).toBe("0x");
    expect(saved).not.toBe(tx);
  });
  it("copies a transaction output cell before later changes without normalizing it", () => {
    const tx = ccc.Transaction.from({
      outputs: [
        {
          capacity: ccc.fixedPointFrom(100),
          lock: {
            codeHash: "0x" + "00".repeat(32),
            hashType: "type",
            args: "0x",
          },
        },
      ],
      outputsData: ["0x1234"],
    });
    const cell = tx.getOutput(0)!;
    expect(Object.getPrototypeOf(cell)).toBe(ccc.CellAny.prototype);
    expect(Object.getPrototypeOf([...tx.outputCells][0])).toBe(
      ccc.CellAny.prototype,
    );
    expect(cell).not.toBeInstanceOf(ccc.Cell);
    expect(cell.cellOutput).toBe(tx.outputs[0]);
    cell.cellOutput.capacity = BigInt(1);

    const [saved] = snapshotOutput([cell]) as [ccc.CellAny];
    tx.outputs[0].capacity = ccc.fixedPointFrom(200);
    cell.cellOutput.lock.args = "0xff";
    cell.outputData = "0xabcd";

    expect(saved).not.toBe(cell);
    expect(saved).toBeInstanceOf(ccc.CellAny);
    expect(saved.outPoint).toBeUndefined();
    expect(saved.cellOutput.capacity).toBe(BigInt(1));
    expect(saved.cellOutput.lock.args).toBe("0x");
    expect(saved.outputData).toBe("0x1234");
  });

  it("retains custom CellAny subclasses that serialize private state", () => {
    class CustomCell extends ccc.CellAny {
      #label = "custom output";
      toJSON() {
        return this.#label;
      }
    }

    const value = new CustomCell(
      new ccc.CellOutput(
        BigInt(1),
        ccc.Script.from({
          codeHash: "0x" + "00".repeat(32),
          hashType: "type",
          args: "0x",
        }),
      ),
      "0x",
    );

    const [saved] = snapshotOutput([value]);

    expect(saved).toBe(value);
    expect(JSON.stringify(saved)).toBe('"custom output"');
  });

  it("keeps Object.prototype available to a custom toJSON on historical state", () => {
    const value = {
      nested: { amount: 1 },
      toJSON() {
        return this.hasOwnProperty("nested") ? this.nested.amount : null;
      },
    };
    const [saved] = snapshotOutput([value]) as [typeof value];
    value.nested.amount = 2;
    expect(Object.getPrototypeOf(saved)).toBe(Object.prototype);
    expect(JSON.stringify(saved)).toBe("1");
  });

  it("keeps null prototypes and copies an own __proto__ key as data", () => {
    const value = { ["__proto__"]: { label: "before" } };
    const dictionary = { ["__proto__"]: value };
    Object.setPrototypeOf(dictionary, null);
    const [saved, savedDictionary] = snapshotOutput([value, dictionary]) as [
      typeof value,
      typeof dictionary,
    ];
    value.__proto__.label = "after";

    expect(Object.getPrototypeOf(saved)).toBe(Object.prototype);
    expect(Object.getPrototypeOf(savedDictionary)).toBeNull();
    expect(Object.hasOwn(saved, "__proto__")).toBe(true);
    expect(Object.hasOwn(savedDictionary, "__proto__")).toBe(true);
    expect(saved.__proto__.label).toBe("before");
    expect(savedDictionary.__proto__).toBe(saved);
  });

  it("keeps arbitrary rich values, bigint and multiple render arguments", () => {
    const custom = { component: "custom" };
    expect(snapshotOutput(["hello", BigInt(1), custom])).toEqual([
      "hello",
      BigInt(1),
      custom,
    ]);
    expect(snapshotOutput([custom])[0]).not.toBe(custom);
    const element = createElement("span", null, "dynamic React");
    expect(snapshotOutput([element])[0]).toBe(element);
  });
});

describe("historical output isolation", () => {
  const script = () =>
    ccc.Script.from({
      codeHash: "0x" + "00".repeat(32),
      hashType: "type",
      args: "0x11",
    });
  it("copies script/cell/address and plain nested data at emission", () => {
    const lock = script();
    const cell = ccc.CellOutput.from({
      capacity: ccc.fixedPointFrom(100),
      lock,
    });
    const address = ccc.Address.from({ prefix: "ckt", script: lock });
    const json = { amount: BigInt(100), nested: { value: 1 } };
    const bytes = new Uint8Array([1, 2]);
    const [savedScript, savedCell, savedAddress, savedJson, savedBytes] =
      snapshotOutput([lock, cell, address, json, bytes]) as [
        ccc.Script,
        ccc.CellOutput,
        ccc.Address,
        typeof json,
        Uint8Array,
      ];
    lock.args = "0x22";
    cell.capacity = BigInt(200);
    json.amount = BigInt(200);
    json.nested.value = 2;
    bytes[0] = 9;
    expect(savedScript.args).toBe("0x11");
    expect(savedCell.capacity).toBe(ccc.fixedPointFrom(100));
    expect(savedAddress.script.args).toBe("0x11");
    expect(savedJson.amount).toBe(BigInt(100));
    expect(savedJson.nested.value).toBe(1);
    expect(savedBytes[0]).toBe(1);
  });
  it("snapshots circular plain data without crashing the running script", () => {
    const data: { self?: unknown } = {};
    data.self = data;
    const [saved] = snapshotOutput([data]) as [typeof data];
    expect(saved).not.toBe(data);
    expect(saved.self).toBe(saved);
  });
  it("starts signer address capture immediately and rejects account replacement during resolution", async () => {
    let replace = () => {};
    let resolve!: (address: ccc.Address) => void;
    const unsubscribe = vi.fn();
    const signer = Object.create(ccc.Signer.prototype) as ccc.Signer;
    signer.onReplaced = (callback) => {
      replace = callback;
      return unsubscribe;
    };
    signer.getRecommendedAddressObj = vi.fn(
      () =>
        new Promise<ccc.Address>((done) => {
          resolve = done;
        }),
    );
    const [captured] = snapshotOutput([signer]) as [SignerOutputSnapshot];
    expect(signer.getRecommendedAddressObj).toHaveBeenCalledOnce();
    replace();
    resolve(ccc.Address.from({ prefix: "ckt", script: script() }));
    const result = await captured.result;
    expect("error" in result).toBe(true);
    expect(unsubscribe).toHaveBeenCalledOnce();
  });
  it("clones a settled signer address so later mutations cannot change history", async () => {
    const address = ccc.Address.from({ prefix: "ckt", script: script() });
    const signer = Object.create(ccc.Signer.prototype) as ccc.Signer;
    const unsubscribe = vi.fn();
    signer.onReplaced = () => unsubscribe;
    signer.getRecommendedAddressObj = vi.fn(async () => address);
    const [captured] = snapshotOutput([signer]) as [SignerOutputSnapshot];
    const result = await captured.result;
    address.script.args = "0xff";
    expect("address" in result && result.address.script.args).toBe("0x11");
    expect(unsubscribe).toHaveBeenCalledOnce();
    expect(signer.getRecommendedAddressObj).toHaveBeenCalledOnce();
  });
});

it("preserves sparse array indexes, nested holes and cyclic references", () => {
  const sparse: unknown[] = new Array(4);
  sparse[2] = "third";
  const nested: unknown[] = new Array(3);
  nested[1] = sparse;
  nested[2] = nested;
  const [saved] = snapshotOutput([nested]) as [unknown[]];
  expect(saved.length).toBe(3);
  expect(0 in saved).toBe(false);
  expect(saved[2]).toBe(saved);
  const inner = saved[1] as unknown[];
  expect(inner.length).toBe(4);
  expect(0 in inner).toBe(false);
  expect(1 in inner).toBe(false);
  expect(inner[2]).toBe("third");
  expect(3 in inner).toBe(false);
  sparse[2] = "changed";
  expect(inner[2]).toBe("third");
});

it("contains throwing getters without losing other properties or logged values", () => {
  const getter = vi.fn(() => {
    throw new Error("unavailable");
  });
  const value = {
    good: { value: 1 },
    get bad() {
      return getter();
    },
  };
  const [saved, next] = snapshotOutput([value, "later value"]) as [
    typeof value,
    string,
  ];
  expect(saved.good).toEqual({ value: 1 });
  expect(saved.bad).toBeInstanceOf(Error);
  expect(next).toBe("later value");
  expect(getter).toHaveBeenCalledOnce();
});
it("contains array getters and hostile object inspection", () => {
  const items = [1, 2, 3];
  Object.defineProperty(items, 1, {
    get() {
      throw new Error("bad getter");
    },
  });
  const hostile = new Proxy(
    {},
    {
      getPrototypeOf() {
        throw new Error("no inspection");
      },
    },
  );
  const [saved, diagnostic, next] = snapshotOutput([
    items,
    hostile,
    "continued",
  ]) as [unknown[], unknown, string];
  expect(saved[0]).toBe(1);
  expect(saved[1]).toBeInstanceOf(Error);
  expect(saved[2]).toBe(3);
  expect(diagnostic).toBeInstanceOf(Error);
  expect(next).toBe("continued");
});
it("preserves huge sparse arrays without visiting every hole", () => {
  const values: unknown[] = new Array(1_000_000_000);
  values[999_999_999] = "last";
  const [copy] = snapshotOutput([values]) as [unknown[]];
  expect(copy.length).toBe(values.length);
  expect(Object.keys(copy)).toEqual(["999999999"]);
  expect(copy[999_999_999]).toBe("last");
});

it("preserves non-enumerable own array slots and contains their getters", () => {
  const values: unknown[] = new Array(3);
  Object.defineProperty(values, "0", { value: "present", enumerable: false });
  const getter = vi.fn(() => {
    throw new Error("unavailable");
  });
  Object.defineProperty(values, "2", { get: getter, enumerable: false });
  const [copy] = snapshotOutput([values]) as [unknown[]];
  expect(copy.length).toBe(3);
  expect(copy[0]).toBe("present");
  expect(1 in copy).toBe(false);
  expect(copy[2]).toBeInstanceOf(Error);
  expect(getter).toHaveBeenCalledOnce();
  expect(
    JSON.stringify(
      snapshotOutput([Object.defineProperty([], "0", { value: "present" })])[0],
    ),
  ).toBe('["present"]');
});

it("preserves inherited array indices without reading overridden getters", () => {
  const values: unknown[] = new Array(2);
  const prototype = Object.create(Array.prototype);
  Object.defineProperty(prototype, "0", { value: "inherited" });
  Object.setPrototypeOf(values, prototype);
  const inheritedGetter = vi.fn(() => "shadowed");
  Object.defineProperty(prototype, "1", { get: inheritedGetter });
  Object.defineProperty(values, "1", { value: "own", enumerable: false });
  const [copy] = snapshotOutput([values]) as [unknown[]];
  expect(copy.length).toBe(2);
  expect(copy[0]).toBe("inherited");
  expect(copy[1]).toBe("own");
  expect(inheritedGetter).not.toHaveBeenCalled();
});
