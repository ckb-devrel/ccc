import { ccc } from "@ckb-ccc/core";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CoinXUdtArgs } from "./args.js";
import { CoinXUdt } from "./coinXUdt.js";

describe("xUDT Utils", () => {
  const hash32: ccc.Hex = ("0x" + "00".repeat(32)) as ccc.Hex;
  const hash31 = "0x" + "00".repeat(31);
  const extensionScript = {
    codeHash: ("0x" + "11".repeat(32)) as ccc.Hex,
    hashType: "data1" as const,
    args: "0x1234",
  };
  const extensionScriptVec = ccc.hexFrom(
    ccc.ScriptVec.encode([extensionScript]),
  );
  const extensionScriptVecHash = ("0x" + "22".repeat(20)) as ccc.Hex;

  describe("CoinXUdtArgs.from", () => {
    it("should generate args with only owner script hash (32 bytes)", () => {
      const args = CoinXUdtArgs.from({ ownerScriptHash: hash32 });
      expect(args.shouldKeepFlag).toBe(false);
      expect(args.toHex()).toBe(hash32);
    });

    it("should keep zero flags when shouldKeepFlag is true", () => {
      const args = CoinXUdtArgs.from({
        ownerScriptHash: hash32,
        shouldKeepFlag: true,
      });
      expect(args.shouldKeepFlag).toBe(true);
      expect(args.toHex()).toBe(hash32 + "00000000");
    });

    it("should round-trip combined extension and owner-mode flags", () => {
      const res = CoinXUdtArgs.from({
        ownerScriptHash: hash32,
        ownerModeInputLockDisabled: true,
        ownerModeOutputType: true,
        ownerModeInputType: true,
        extensionData: { type: "ScriptVec", value: [extensionScript] },
      }).toHex();
      expect(res).toBe(hash32 + "010000e0" + extensionScriptVec.slice(2));

      const parsed = CoinXUdtArgs.fromBytes(res);
      expect(parsed.ownerModeInputLockDisabled).toBe(true);
      expect(parsed.ownerModeOutputType).toBe(true);
      expect(parsed.ownerModeInputType).toBe(true);
      expect(parsed.extensionData.inner.type).toBe("ScriptVec");
    });

    it("should encode a 20-byte ScriptVec hash for extension mode 2", () => {
      const res = CoinXUdtArgs.from({
        ownerScriptHash: hash32,
        extensionData: {
          type: "ScriptVecHash",
          value: extensionScriptVecHash,
        },
      }).toHex();
      expect(res).toBe(hash32 + "02000000" + extensionScriptVecHash.slice(2));
    });

    it("should throw error if owner script hash is not 32 bytes", () => {
      expect(() =>
        CoinXUdtArgs.from({
          ownerScriptHash: hash31,
        }),
      ).toThrow("Invalid owner script hash length");
    });
  });

  describe("CoinXUdtArgs.fromBytes", () => {
    it("should parse 32-byte args", () => {
      const parsed = CoinXUdtArgs.fromBytes(hash32);
      expect(parsed.ownerScriptHash).toBe(hash32);
      expect(parsed.ownerModeInputLockDisabled).toBe(false);
      expect(parsed.ownerModeOutputType).toBe(false);
      expect(parsed.ownerModeInputType).toBe(false);
      expect(parsed.extensionData.inner).toEqual({
        type: "Empty",
        value: undefined,
      });
      expect(parsed.shouldKeepFlag).toBe(false);
      expect(parsed.toHex()).toBe(hash32);
    });

    it("should decode a molecule ScriptVec for extension mode 1", () => {
      const rawArgs = hash32 + "01000000" + extensionScriptVec.slice(2);
      const parsed = CoinXUdtArgs.fromBytes(rawArgs);
      expect(parsed.ownerScriptHash).toBe(hash32);
      expect(parsed.shouldKeepFlag).toBe(false);
      expect(parsed.extensionData.inner).toEqual({
        type: "ScriptVec",
        value: [ccc.Script.from(extensionScript)],
      });
      expect(parsed.toHex()).toBe(rawArgs);
    });

    it("should decode a 20-byte ScriptVec hash for extension mode 2", () => {
      const rawArgs = hash32 + "02000000" + extensionScriptVecHash.slice(2);
      const parsed = CoinXUdtArgs.fromBytes(rawArgs);
      expect(parsed.shouldKeepFlag).toBe(false);
      expect(parsed.extensionData.inner).toEqual({
        type: "ScriptVecHash",
        value: extensionScriptVecHash,
      });
      expect(parsed.toHex()).toBe(rawArgs);
    });

    it("should preserve an explicitly encoded zero flags field", () => {
      const rawArgs = hash32 + "00000000";
      const parsed = CoinXUdtArgs.fromBytes(rawArgs);
      expect(parsed.shouldKeepFlag).toBe(true);
      expect(parsed.extensionData.inner.type).toBe("Empty");
      expect(parsed.toHex()).toBe(rawArgs);
    });

    it("should throw if args length is invalid", () => {
      expect(() => CoinXUdtArgs.fromBytes(hash32 + "00")).toThrow(
        "Invalid xUDT args length",
      );
    });

    it("should reject extension data that does not match its flags", () => {
      expect(() =>
        CoinXUdtArgs.fromBytes(hash32 + "00000000" + "11"),
      ).toThrow();
      expect(() =>
        CoinXUdtArgs.fromBytes(hash32 + "01000000" + "11"),
      ).toThrow();
      expect(() => CoinXUdtArgs.fromBytes(hash32 + "02000000" + "11")).toThrow(
        "expected byte length 20",
      );
      expect(() => CoinXUdtArgs.fromBytes(hash32 + "03000000")).toThrow(
        "unknown union field",
      );
    });
  });
});

describe("CoinXUdt", () => {
  let client: ccc.Client;
  let signer: ccc.Signer;
  const hash32: ccc.Hex = ("0x" + "00".repeat(32)) as ccc.Hex;
  const hash32_alt: ccc.Hex = ("0x" + "11".repeat(32)) as ccc.Hex;
  const explicitScript = {
    codeHash: hash32,
    hashType: "type" as const,
    args: hash32,
  };

  beforeEach(() => {
    client = new ccc.ClientPublicTestnet();
    signer = new ccc.SignerCkbPublicKey(
      client,
      "0x026f3255791f578cc5e38783b6f2d87d4709697b797def6bf7b3b9af4120e2bfd9",
    );
  });

  it("should preserve extension data from script.args", async () => {
    const extensionScript = {
      codeHash: hash32_alt,
      hashType: "data1" as const,
      args: "0x112233",
    };
    const rawArgs =
      hash32 +
      "01000000" +
      ccc.hexFrom(ccc.ScriptVec.encode([extensionScript])).slice(2);
    const coin = new CoinXUdt({
      script: {
        codeHash: hash32,
        hashType: "type",
        args: rawArgs,
      },
      cellDeps: [],
      client: signer.client,
    });

    expect(coin.args.extensionData.inner).toEqual({
      type: "ScriptVec",
      value: [ccc.Script.from(extensionScript)],
    });
    expect((await coin.script).args).toBe(rawArgs);
  });

  it("should prioritize xUdtArgs over script.args if both are provided", async () => {
    const coin = new CoinXUdt({
      script: {
        codeHash: hash32,
        hashType: "type",
        args: hash32_alt,
      },
      cellDeps: [],
      xUdtArgs: {
        ownerScriptHash: hash32,
        ownerModeOutputType: true,
      },
      client: signer.client,
    });

    expect(coin.args.ownerScriptHash).toBe(hash32);
    expect(coin.args.ownerModeOutputType).toBe(true);

    const script = await coin.script;
    expect(script.args).toBe(hash32 + "00000040");
  });

  it("should throw error if both xUdtArgs and script.args are missing", () => {
    expect(
      () =>
        new CoinXUdt({
          client: signer.client,
        }),
    ).toThrow("Either xUdtArgs or script.args must be provided");
  });

  it("should default knownScript to XUdt and add cell deps", async () => {
    const mockCellDep = ccc.CellDep.from({
      outPoint: {
        txHash: hash32,
        index: 0,
      },
      depType: "code",
    });

    vi.spyOn(client, "getKnownScript").mockResolvedValue({
      codeHash: hash32_alt,
      hashType: "type",
      cellDeps: [
        {
          cellDep: ccc.CellDep.from({
            outPoint: {
              txHash: hash32,
              index: 0,
            },
            depType: "code",
          }),
        },
      ],
    });

    vi.spyOn(client, "getCellDeps").mockResolvedValue([mockCellDep]);

    const coin = new CoinXUdt({
      xUdtArgs: {
        ownerScriptHash: hash32,
      },
      client: signer.client,
    });

    const script = await coin.script;
    expect(script.codeHash).toBe(hash32_alt);
    expect(script.hashType).toBe("type");

    const cellDeps = await coin.cellDeps;
    expect(cellDeps.length).toBe(1);
    expect(cellDeps[0]).toEqual(mockCellDep);
  });

  it("should not mix balances of xUDT with different owner-mode flags", async () => {
    const coinFlags0 = new CoinXUdt({
      script: explicitScript,
      cellDeps: [],
      xUdtArgs: {
        ownerScriptHash: hash32,
      },
      client: signer.client,
    });

    const coinFlagsOutputType = new CoinXUdt({
      script: explicitScript,
      cellDeps: [],
      xUdtArgs: {
        ownerScriptHash: hash32,
        ownerModeOutputType: true,
      },
      client: signer.client,
    });

    const cellFlags0 = ccc.Cell.from({
      outPoint: {
        txHash: hash32,
        index: 0,
      },
      cellOutput: {
        capacity: ccc.fixedPointFrom(142),
        lock: {
          codeHash: hash32,
          hashType: "type",
          args: "0x",
        },
        type: await coinFlags0.script,
      },
      outputData: ccc.numLeToBytes(100, 16),
    });

    const cellFlagsOutputType = ccc.Cell.from({
      outPoint: {
        txHash: hash32,
        index: 1,
      },
      cellOutput: {
        capacity: ccc.fixedPointFrom(142),
        lock: {
          codeHash: hash32,
          hashType: "type",
          args: "0x",
        },
        type: await coinFlagsOutputType.script,
      },
      outputData: ccc.numLeToBytes(200, 16),
    });

    const cells = [cellFlags0, cellFlagsOutputType];

    expect(await coinFlags0.amountFrom(cells)).toBe(ccc.numFrom(100));
    expect(await coinFlagsOutputType.amountFrom(cells)).toBe(ccc.numFrom(200));
  });
});
