import { ccc } from "@ckb-ccc/core";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  assembleCreateSporeAction,
  assembleMeltSporeAction,
  assembleTransferSporeAction,
  checkSporeIntent,
  injectCobuild,
} from "./index.js";

const lockA = ccc.Script.from({
  codeHash: "0x" + "11".repeat(32),
  hashType: "type",
  args: "0x01",
});
const lockB = ccc.Script.from({
  codeHash: "0x" + "22".repeat(32),
  hashType: "type",
  args: "0x02",
});
const sporeId = "0x" + "33".repeat(32);
const sporeType = ccc.Script.from({
  codeHash: "0x" + "44".repeat(32),
  hashType: "type",
  args: sporeId,
});
const content = ccc.hexFrom(ccc.bytesFrom("hello, spore", "utf8"));
const capacity = 10000000000n;

let client: ccc.Client;

/** Input cell spent by every transaction below. */
const inputCell = ccc.Cell.from({
  outPoint: ccc.OutPoint.from({
    txHash: "0x" + "55".repeat(32),
    index: 0n,
  }),
  cellOutput: ccc.CellOutput.from({
    capacity,
    lock: lockA,
  }),
  outputData: "0x",
});

beforeEach(() => {
  client = {
    getCell: vi.fn(async () => ({ ...inputCell })),
  } as unknown as ccc.Client;
});

describe("checkSporeIntent", () => {
  it("returns no actions for transactions without a CoBuild witness", async () => {
    const tx = ccc.Transaction.from({
      inputs: [{ previousOutput: inputCell.outPoint }],
    });
    expect(await checkSporeIntent({ client, tx })).toEqual([]);
  });

  it("accepts a truthful create intent", async () => {
    const output = {
      capacity,
      lock: lockB,
      type: sporeType,
    };
    const tx = ccc.Transaction.from({
      inputs: [{ previousOutput: inputCell.outPoint }],
      outputs: [output],
      outputsData: [content],
      witnesses: [],
    });
    const action = assembleCreateSporeAction(output, ccc.bytesFrom(content));
    injectCobuild(tx, [action]);

    const checked = await checkSporeIntent({ client, tx });
    expect(checked.length).toBe(1);
  });

  it("passes actions of unknown protocols through unchecked", async () => {
    const output = {
      capacity,
      lock: lockB,
      type: sporeType,
    };
    const tx = ccc.Transaction.from({
      inputs: [{ previousOutput: inputCell.outPoint }],
      outputs: [output],
      outputsData: [content],
    });
    const action = assembleCreateSporeAction(output, ccc.bytesFrom(content));
    injectCobuild(tx, [{ ...action, scriptHash: "0x" + "99".repeat(32) }]);

    expect((await checkSporeIntent({ client, tx })).length).toBe(1);
  });

  it("rejects a misleading data hash", async () => {
    const output = {
      capacity,
      lock: lockB,
      type: sporeType,
    };
    const tx = ccc.Transaction.from({
      inputs: [{ previousOutput: inputCell.outPoint }],
      outputs: [output],
      outputsData: [content],
    });
    const action = assembleCreateSporeAction(
      output,
      ccc.bytesFrom("tampered", "utf8"),
    );
    injectCobuild(tx, [action]);

    await expect(checkSporeIntent({ client, tx })).rejects.toThrow(
      /data hash mismatch/,
    );
  });

  it("rejects a misleading recipient", async () => {
    const output = {
      capacity,
      lock: lockB,
      type: sporeType,
    };
    const tx = ccc.Transaction.from({
      inputs: [{ previousOutput: inputCell.outPoint }],
      outputs: [output],
      outputsData: [content],
    });
    const action = assembleCreateSporeAction(
      { ...output, lock: lockA },
      ccc.bytesFrom(content),
    );
    injectCobuild(tx, [action]);

    await expect(checkSporeIntent({ client, tx })).rejects.toThrow(
      /to mismatch/,
    );
  });

  it("rejects duplicated actions", async () => {
    const output = {
      capacity,
      lock: lockB,
      type: sporeType,
    };
    const tx = ccc.Transaction.from({
      inputs: [{ previousOutput: inputCell.outPoint }],
      outputs: [output],
      outputsData: [content],
    });
    const action = assembleCreateSporeAction(output, ccc.bytesFrom(content));
    injectCobuild(tx, [action, action]);

    await expect(checkSporeIntent({ client, tx })).rejects.toThrow(
      /Duplicated/,
    );
  });

  it("accepts a truthful transfer intent and checks the sender", async () => {
    const spentSpore = ccc.Cell.from({
      ...inputCell,
      cellOutput: ccc.CellOutput.from({
        capacity,
        lock: lockA,
        type: sporeType,
      }),
      outputData: content,
    });
    client = {
      getCell: vi.fn(async () => ({ ...spentSpore })),
    } as unknown as ccc.Client;

    const output = {
      capacity,
      lock: lockB,
      type: sporeType,
    };
    const tx = ccc.Transaction.from({
      inputs: [{ previousOutput: inputCell.outPoint }],
      outputs: [output],
      outputsData: [content],
    });
    const action = assembleTransferSporeAction(spentSpore.cellOutput, output);
    injectCobuild(tx, [action]);
    expect((await checkSporeIntent({ client, tx })).length).toBe(1);

    const forged = ccc.Transaction.from({
      inputs: [{ previousOutput: inputCell.outPoint }],
      outputs: [output],
      outputsData: [content],
    });
    injectCobuild(forged, [
      assembleTransferSporeAction(
        { ...spentSpore.cellOutput, lock: lockB },
        output,
      ),
    ]);
    await expect(checkSporeIntent({ client, tx: forged })).rejects.toThrow(
      /from mismatch/,
    );
  });

  it("rejects a melt intent when the Spore survives in the outputs", async () => {
    const spentSpore = ccc.Cell.from({
      ...inputCell,
      cellOutput: ccc.CellOutput.from({
        capacity,
        lock: lockA,
        type: sporeType,
      }),
      outputData: content,
    });
    client = {
      getCell: vi.fn(async () => ({ ...spentSpore })),
    } as unknown as ccc.Client;

    const output = {
      capacity,
      lock: lockB,
      type: sporeType,
    };
    const tx = ccc.Transaction.from({
      inputs: [{ previousOutput: inputCell.outPoint }],
      outputs: [output],
      outputsData: [content],
    });
    const action = assembleMeltSporeAction(spentSpore.cellOutput);
    injectCobuild(tx, [action]);

    await expect(checkSporeIntent({ client, tx })).rejects.toThrow(
      /MeltSpore over a kept cell/,
    );
  });
});
