import { ccc } from "@ckb-ccc/core";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SUdt } from "./sUdt.js";

describe("SUdt", () => {
  let client: ccc.Client;
  let signer: ccc.Signer;
  const ownerLockHash =
    "0xf8f94a13dfe1b87c10312fb9678ab5276eefbe1e0b2c62b4841b1f393494eff2";

  beforeEach(() => {
    client = new ccc.ClientPublicTestnet();
    signer = new ccc.SignerCkbPublicKey(
      client,
      "0x026f3255791f578cc5e38783b6f2d87d4709697b797def6bf7b3b9af4120e2bfd9",
    );
  });

  it("should initialize with explicit script info", async () => {
    const codeHash =
      "0xc5e5dcf215925f7ef4dfaf5f4b4f105bc321c02776d6e7d52a1db3fcd9d011a4";
    const hashType = "type";
    const cellDeps = [
      {
        outPoint: {
          txHash:
            "0xe12877ebd2c3c364dc46c5c992bcfaf4fee33fa13eebdf82c591fc9825aab769",
          index: 0,
        },
        depType: "code" as const,
      },
    ];

    const sUdt = new SUdt({
      script: {
        codeHash,
        hashType,
        args: ownerLockHash,
      },
      cellDeps,
      signer,
    });

    const script = await sUdt.script;
    const resolvedCellDeps = await sUdt.cellDeps;
    expect(script.codeHash).toBe(codeHash);
    expect(script.hashType).toBe(hashType);
    expect(script.args).toBe(ownerLockHash);
    expect(resolvedCellDeps.length).toBe(1);
    expect(resolvedCellDeps[0].outPoint.txHash).toBe(
      cellDeps[0].outPoint.txHash,
    );
  });

  it("should retrieve script info from client on demand when omitted", async () => {
    const getKnownScriptSpy = vi.spyOn(client, "getKnownScript");

    const sUdt = new SUdt({
      script: {
        args: ownerLockHash,
      },
      signer,
    });

    // Before calling any async method, accessing properties synchronously returns Promises
    expect(sUdt.script).toBeInstanceOf(Promise);
    expect(sUdt.cellDeps).toBeInstanceOf(Promise);
    expect(sUdt.filter).toBeInstanceOf(Promise);

    // Call an async method (e.g., infoFrom with empty array)
    const info = await sUdt.infoFrom([]);
    expect(info.balance).toBe(ccc.Zero);

    // It should have queried client.getKnownScript
    expect(getKnownScriptSpy).toHaveBeenCalledWith(ccc.KnownScript.SUdt);

    // It should now have the correct script info populated
    const expectedSUdtInfo = await client.getKnownScript(ccc.KnownScript.SUdt);
    const script = await sUdt.script;
    const resolvedCellDeps = await sUdt.cellDeps;
    expect(script.codeHash).toBe(expectedSUdtInfo.codeHash);
    expect(script.hashType).toBe(expectedSUdtInfo.hashType);
    expect(script.args).toBe(ownerLockHash);
    expect(resolvedCellDeps.length).toBe(1);
    expect(resolvedCellDeps[0].outPoint.txHash).toBe(
      expectedSUdtInfo.cellDeps[0].cellDep.outPoint.txHash,
    );
  });
});
