import { ccc } from "@ckb-ccc/core";
import { describe, expect, it } from "vitest";
import {
  SCRIPTS_CLUSTER_MAINNET,
  SCRIPTS_CLUSTER_TESTNET,
  SCRIPTS_MUTANT_MAINNET,
  SCRIPTS_MUTANT_TESTNET,
  SCRIPTS_SPORE_MAINNET,
  SCRIPTS_SPORE_TESTNET,
} from "./advanced.js";
import { SporeVersion } from "./types.js";
import {
  getClusterScriptInfo,
  getMutantScriptInfo,
  getSporeScriptInfo,
} from "./utils.js";

const testnetClient = { addressPrefix: "ckt" } as unknown as ccc.Client;
const mainnetClient = { addressPrefix: "ckb" } as unknown as ccc.Client;

describe("Spore v3 presets", () => {
  it("reserves V3 entries until the contracts are deployed", () => {
    for (const scripts of [
      SCRIPTS_SPORE_TESTNET,
      SCRIPTS_SPORE_MAINNET,
      SCRIPTS_CLUSTER_TESTNET,
      SCRIPTS_CLUSTER_MAINNET,
    ]) {
      expect(scripts[SporeVersion.V3]).toBeUndefined();
    }
  });

  it("keeps existing versions intact", () => {
    expect(SCRIPTS_SPORE_TESTNET[SporeVersion.V2]).toBeDefined();
    expect(SCRIPTS_CLUSTER_TESTNET[SporeVersion.V2]).toBeDefined();
    expect(getSporeScriptInfo(testnetClient).codeHash).toBeDefined();
    expect(getClusterScriptInfo(mainnetClient).codeHash).toBeDefined();
  });
});

describe("Mutant presets", () => {
  it("exists for both networks with an empty V3 entry", () => {
    expect(SCRIPTS_MUTANT_TESTNET[SporeVersion.V3]).toBeUndefined();
    expect(SCRIPTS_MUTANT_MAINNET[SporeVersion.V3]).toBeUndefined();
  });

  it("throws helpful errors until deployments are published", () => {
    expect(() => getMutantScriptInfo(testnetClient)).toThrow(/Mutant script/);
    expect(() => getSporeScriptInfo(testnetClient, SporeVersion.V3)).toThrow(
      /not found/,
    );
  });
});
