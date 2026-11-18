import { ccc } from "@ckb-ccc/core";
import { describe, expect, it, vi } from "vitest";
import {
  createSporeCodeDeployment,
  createSporeDeploymentProfile,
  resolveSporeCodeDeployment,
} from "./index.js";

const hex = (byte: string) => ccc.hexFrom(byte.repeat(32));
const policy = ccc.Script.from({
  codeHash: hex("11"),
  hashType: "type",
  args: "0x",
});
const description = {
  typeId: hex("22"),
  cellDep: {
    outPoint: { txHash: hex("33"), index: 0 },
    depType: "code" as const,
  },
  governanceLock: policy,
};
const clientFor = (cell?: ccc.Cell) =>
  ({
    findSingletonCellByType: vi.fn(async () => cell),
  }) as unknown as ccc.Client;

describe("type-bound Spore code deployments", () => {
  it("derives the code reference from the standard Type ID, preserving live resolution", () => {
    const deployment = createSporeCodeDeployment(description);
    expect(deployment.scriptInfo.hashType).toBe("type");
    expect(deployment.scriptInfo.codeHash).toBe(deployment.codeType.hash());
    expect(
      deployment.scriptInfo.cellDeps[0].type?.eq(deployment.codeType),
    ).toBe(true);
    expect(deployment.codeType.args).toBe(description.typeId);
    expect(
      createSporeCodeDeployment({ ...description, typeId: hex("01") })
        .scriptInfo.codeHash,
    ).toBe(
      "0x946f717cf6324bcd09ebfbdfabab3cd41d49d6b2091f4c529d58ea3aa8356b5b",
    );
  });
  it.each(["0x", "0x1234"])("rejects malformed Type ID %s", (typeId) => {
    expect(() => createSporeCodeDeployment({ ...description, typeId })).toThrow(
      /32 bytes/,
    );
  });
  it("rejects depGroups and malformed binary pins", () => {
    expect(() =>
      createSporeCodeDeployment({
        ...description,
        cellDep: { ...description.cellDep, depType: "depGroup" },
      }),
    ).toThrow(/code CellDep/);
    expect(() =>
      createSporeCodeDeployment({ ...description, expectedDataHash: "0x01" }),
    ).toThrow(/32 bytes/);
  });
  it("follows a successor with changed bytes and OutPoint under the reviewed Lock", async () => {
    const deployment = createSporeCodeDeployment(description);
    const successor = ccc.Cell.from({
      outPoint: { txHash: hex("44"), index: 1 },
      cellOutput: {
        capacity: 10000000000n,
        lock: policy,
        type: deployment.codeType,
      },
      outputData: "0x0102",
    });
    expect(
      await resolveSporeCodeDeployment(clientFor(successor), deployment),
    ).toBe(successor);
    // Exercise CCC's actual dependency resolver, not only this package's helper.
    const deps = await ccc.Client.prototype.getCellDeps.call(
      clientFor(successor),
      deployment.scriptInfo.cellDeps,
    );
    expect(deps[0].outPoint.eq(successor.outPoint)).toBe(true);
    expect(
      deps[0].outPoint.eq(ccc.OutPoint.from(description.cellDep.outPoint)),
    ).toBe(false);
  });
  it("requires review when the Lock, identity or pinned binary changes", async () => {
    const deployment = createSporeCodeDeployment({
      ...description,
      expectedDataHash: ccc.hashCkb("0x01"),
    });
    const code = ccc.Cell.from({
      outPoint: description.cellDep.outPoint,
      cellOutput: {
        capacity: 10000000000n,
        lock: policy,
        type: deployment.codeType,
      },
      outputData: "0x01",
    });
    await expect(
      resolveSporeCodeDeployment(clientFor(code), deployment),
    ).resolves.toBe(code);
    const changedCode = code.clone();
    changedCode.outputData = "0x02";
    await expect(
      resolveSporeCodeDeployment(clientFor(changedCode), deployment),
    ).rejects.toThrow(/binary pin/);
    const changedLock = code.clone();
    changedLock.cellOutput.lock.args = "0x01";
    await expect(
      resolveSporeCodeDeployment(clientFor(changedLock), deployment),
    ).rejects.toThrow(/governance Lock/);
    const changedType = code.clone();
    changedType.cellOutput.type!.args = hex("55");
    await expect(
      resolveSporeCodeDeployment(clientFor(changedType), deployment),
    ).rejects.toThrow(/identity/);
    await expect(
      resolveSporeCodeDeployment(clientFor(), deployment),
    ).rejects.toThrow(/not found/);
  });
  it("does not alias caller-owned policy scripts", () => {
    const supplied = { ...description, governanceLock: policy.clone() };
    const deployment = createSporeCodeDeployment(supplied);
    supplied.governanceLock.args = "0xff";
    expect(deployment.governanceLock.args).toBe("0x");
  });

  it("rejects inconsistent descriptors before resolving a code Cell", async () => {
    const deployment = createSporeCodeDeployment(description);
    deployment.scriptInfo.codeHash = hex("ff");
    await expect(
      resolveSporeCodeDeployment(clientFor(), deployment),
    ).rejects.toThrow(/Inconsistent/);
  });
  it("keeps deployment roles distinct", () => {
    const profile = createSporeDeploymentProfile({
      spore: description,
      cluster: { ...description, typeId: hex("66") },
      mutant: { ...description, typeId: hex("77") },
    });
    expect(profile.cluster?.scriptInfo.hashType).toBe("type");
    expect(() =>
      createSporeDeploymentProfile({
        spore: description,
        cluster: description,
        mutant: description,
      }),
    ).toThrow(/distinct/);
  });
});
