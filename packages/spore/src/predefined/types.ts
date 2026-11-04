import { ccc } from "@ckb-ccc/core";

export const DEFAULT_COBUILD_INFO_HASH = ccc.hashCkb(
  ccc.bytesFrom("CCC_DEFAULT_COBUILD_INFO", "utf8"),
);

export enum SporeVersion {
  V1 = "V1",
  V2 = "V2",
  DID = "DID",
  /**
   * Spore v3 contracts (spore-contract PRs #75/#76): CKB-VM2 `data2`
   * Spore/Cluster scripts, native Rust Mutants, and optional CoBuild intent.
   *
   * Preset entries stay `undefined` until the contracts are deployed;
   * pass a custom `SporeScriptInfoLike` to try a v3 deployment early.
   */
  V3 = "V3",
}

export const SPORE_VERSION_DEFAULT = SporeVersion.V2;

export type SporeScriptInfoLike = ccc.ScriptInfoLike & {
  /**
   * When true, transactions attach CoBuild Actions by default.
   *
   * For Spore v3 scripts Actions are optional intent metadata
   * (spore-contract#76): keep this enabled for wallet display, and
   * opt out per call with `withIntent: false`.
   */
  cobuild?: boolean;
};

export class SporeScriptInfo extends ccc.ScriptInfo {
  constructor(
    codeHash: ccc.Hex,
    hashType: ccc.HashType,
    cellDeps: ccc.CellDepInfo[],
    public cobuild?: boolean,
  ) {
    super(codeHash, hashType, cellDeps);
  }

  static from(scriptInfoLike: SporeScriptInfoLike): SporeScriptInfo {
    return new SporeScriptInfo(
      ccc.hexFrom(scriptInfoLike.codeHash),
      ccc.hashTypeFrom(scriptInfoLike.hashType),
      scriptInfoLike.cellDeps.map((c) => ccc.CellDepInfo.from(c)),
      scriptInfoLike.cobuild,
    );
  }
}
