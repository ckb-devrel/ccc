import { SporeScriptInfoLike, SporeVersion } from "./types.js";

export const SCRIPTS_SPORE_TESTNET: Record<
  SporeVersion,
  SporeScriptInfoLike | undefined
> = Object.freeze({
  [SporeVersion.DID]: {
    codeHash:
      "0x0b1f412fbae26853ff7d082d422c2bdd9e2ff94ee8aaec11240a5b34cc6e890f",
    hashType: "type",
    cellDeps: [
      {
        cellDep: {
          outPoint: {
            txHash:
              "0x306961e0eb04ed972c60cb89a0aed1b0ef065d96d2fc0000c62db5275e32dc6f",
            index: 0,
          },
          depType: "code",
        },
        type: {
          codeHash:
            "0x00000000000000000000000000000000000000000000000000545950455f4944",
          hashType: "type",
          args: "0x80f0d4bf6b3951911aa6b98cc609d477a8a10b903b35cfd528d098e95c36f680",
        },
      },
    ],
  },
  [SporeVersion.V2]: {
    codeHash:
      "0x685a60219309029d01310311dba953d67029170ca4848a4ff638e57002130a0d",
    hashType: "data1",
    cellDeps: [
      {
        cellDep: {
          outPoint: {
            txHash:
              "0x5e8d2a517d50fd4bb4d01737a7952a1f1d35c8afc77240695bb569cd7d9d5a1f",
            index: 0,
          },
          depType: "code",
        },
      },
    ],
    cobuild: true,
  },
  [SporeVersion.V1]: {
    codeHash:
      "0xbbad126377d45f90a8ee120da988a2d7332c78ba8fd679aab478a19d6c133494",
    hashType: "data1",
    cellDeps: [
      {
        cellDep: {
          outPoint: {
            txHash:
              "0xfd694382e621f175ddf81ce91ce2ecf8bfc027d53d7d31b8438f7d26fc37fd19",
            index: 0,
          },
          depType: "code",
        },
      },
    ],
  },
  // Pending the testnet deployment of spore-contract PRs #75/#76.
  [SporeVersion.V3]: undefined,
});

/**
 * Mutant extension scripts. The v3 entry is the native Rust Mutant
 * extension (`spore_extension_rust`, `type`) from spore-contract#75:
 * its cell data is the executed RISC-V ELF itself.
 */
export const SCRIPTS_MUTANT_TESTNET: Record<
  SporeVersion,
  SporeScriptInfoLike | undefined
> = Object.freeze({
  [SporeVersion.V1]: undefined,
  [SporeVersion.V2]: undefined,
  [SporeVersion.DID]: undefined,
  // Pending the testnet deployment of spore-contract#75.
  [SporeVersion.V3]: undefined,
});

export const SCRIPTS_CLUSTER_TESTNET: Record<
  SporeVersion,
  SporeScriptInfoLike | undefined
> = Object.freeze({
  [SporeVersion.V2]: {
    codeHash:
      "0x0bbe768b519d8ea7b96d58f1182eb7e6ef96c541fbd9526975077ee09f049058",
    hashType: "data1",
    cellDeps: [
      {
        cellDep: {
          outPoint: {
            txHash:
              "0xcebb174d6e300e26074aea2f5dbd7f694bb4fe3de52b6dfe205e54f90164510a",
            index: 0,
          },
          depType: "code",
        },
      },
    ],
    cobuild: true,
  },
  [SporeVersion.V1]: {
    codeHash:
      "0x598d793defef36e2eeba54a9b45130e4ca92822e1d193671f490950c3b856080",
    hashType: "data1",
    cellDeps: [
      {
        cellDep: {
          outPoint: {
            txHash:
              "0x49551a20dfe39231e7db49431d26c9c08ceec96a29024eef3acc936deeb2ca76",
            index: 0,
          },
          depType: "code",
        },
      },
    ],
  },
  [SporeVersion.DID]: undefined,
  // Pending the testnet deployment of spore-contract PRs #75/#76.
  [SporeVersion.V3]: undefined,
});
