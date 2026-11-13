import { SporeScriptInfoLike, SporeVersion } from "./types.js";

export const SCRIPTS_SPORE_MAINNET: Record<
  SporeVersion,
  SporeScriptInfoLike | undefined
> = Object.freeze({
  [SporeVersion.DID]: {
    codeHash:
      "0xcfba73b58b6f30e70caed8a999748781b164ef9a1e218424a6fb55ebf641cb33",
    hashType: "type",
    cellDeps: [
      {
        cellDep: {
          outPoint: {
            txHash:
              "0x37c80ba8124780920bc8fe06b49e3535b43ca339bb9a97fb462b16d575bfa9a6",
            index: 0,
          },
          depType: "code",
        },
        type: {
          codeHash:
            "0x00000000000000000000000000000000000000000000000000545950455f4944",
          hashType: "type",
          args: "0x62312cd846659e188b05da11dc3f080b083c27371ea701d6026e11e713e0e3de",
        },
      },
    ],
    cobuild: true,
  },
  [SporeVersion.V2]: {
    codeHash:
      "0x4a4dce1df3dffff7f8b2cd7dff7303df3b6150c9788cb75dcf6747247132b9f5",
    hashType: "data1",
    cellDeps: [
      {
        cellDep: {
          outPoint: {
            txHash:
              "0x96b198fb5ddbd1eed57ed667068f1f1e55d07907b4c0dbd38675a69ea1b69824",
            index: 0,
          },
          depType: "code",
        },
      },
    ],
    cobuild: true,
  },
  [SporeVersion.V1]: undefined,
  // Pending the mainnet deployment of spore-contract PRs #75/#76.
  [SporeVersion.V3]: undefined,
});

export const SCRIPTS_CLUSTER_MAINNET: Record<
  SporeVersion,
  SporeScriptInfoLike | undefined
> = Object.freeze({
  [SporeVersion.V2]: {
    codeHash:
      "0x7366a61534fa7c7e6225ecc0d828ea3b5366adec2b58206f2ee84995fe030075",
    hashType: "data1",
    cellDeps: [
      {
        cellDep: {
          outPoint: {
            txHash:
              "0xe464b7fb9311c5e2820e61c99afc615d6b98bdefbe318c34868c010cbd0dc938",
            index: 0,
          },
          depType: "code",
        },
      },
    ],
    cobuild: true,
  },
  [SporeVersion.V1]: undefined,
  [SporeVersion.DID]: undefined,
  // Pending the mainnet deployment of spore-contract PRs #75/#76.
  [SporeVersion.V3]: undefined,
});

/**
 * Mutant extension scripts. The v3 entry is the native Rust Mutant
 * extension (`spore_extension_rust`, `type`) from spore-contract#75:
 * its cell data is the executed RISC-V ELF itself.
 */
export const SCRIPTS_MUTANT_MAINNET: Record<
  SporeVersion,
  SporeScriptInfoLike | undefined
> = Object.freeze({
  [SporeVersion.V1]: undefined,
  [SporeVersion.V2]: undefined,
  [SporeVersion.DID]: undefined,
  // Pending the mainnet deployment of spore-contract#75.
  [SporeVersion.V3]: undefined,
});
