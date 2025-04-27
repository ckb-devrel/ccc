import { ScriptInfoLike } from "./clientTypes.js";
import { KnownScript } from "./knownScript.js";

export const MAINNET_SCRIPTS: Record<KnownScript, ScriptInfoLike | undefined> =
  Object.freeze({
    [KnownScript.NervosDao]: {
      codeHash:
        "0x82d76d1b75fe2fd9a27dfbaa65a039221a380d76c926f378d3f81cf3e7e13f2e",
      hashType: "type",
      cellDeps: [
        {
          cellDep: {
            outPoint: {
              txHash:
                "0xe2fb199810d49a4d8beec56718ba2593b665db9d52299a0f9e6e75416d73ff5c",
              index: 2,
            },
            depType: "code",
          },
        },
      ],
    },
    [KnownScript.Secp256k1Blake160]: {
      codeHash:
        "0x9bd7e06f3ecf4be0f2fcd2188b23f1b9fcc88e5d4b65a8637b17723bbda3cce8",
      hashType: "type",
      cellDeps: [
        {
          cellDep: {
            outPoint: {
              txHash:
                "0x71a7ba8fc96349fea0ed3a5c47992e3b4084b031a42264a018e0072e8172e46c",
              index: 0,
            },
            depType: "depGroup",
          },
        },
      ],
    },
    [KnownScript.Secp256k1Multisig]: {
      codeHash:
        "0x5c5069eb0857efc65e1bca0c07df34c31663b3622fd3876c876320fc9634e2a8",
      hashType: "type",
      cellDeps: [
        {
          cellDep: {
            outPoint: {
              txHash:
                "0x71a7ba8fc96349fea0ed3a5c47992e3b4084b031a42264a018e0072e8172e46c",
              index: 1,
            },
            depType: "depGroup",
          },
        },
      ],
    },
    [KnownScript.Secp256k1MultisigV2]: {
      codeHash:
        "0x36c971b8d41fbd94aabca77dc75e826729ac98447b46f91e00796155dddb0d29",
      hashType: "data1",
      cellDeps: [
        {
          cellDep: {
            outPoint: {
              txHash:
                "0x6888aa39ab30c570c2c30d9d5684d3769bf77265a7973211a3c087fe8efbf738",
              index: 0,
            },
            depType: "depGroup",
          },
        },
      ],
    },
    [KnownScript.AnyoneCanPay]: {
      codeHash:
        "0xd369597ff47f29fbc0d47d2e3775370d1250b85140c670e4718af712983a2354",
      hashType: "type",
      cellDeps: [
        {
          cellDep: {
            outPoint: {
              txHash:
                "0x4153a2014952d7cac45f285ce9a7c5c0c0e1b21f2d378b82ac1433cb11c25c4d",
              index: 0,
            },
            depType: "depGroup",
          },
        },
      ],
    },
    [KnownScript.TypeId]: {
      codeHash:
        "0x00000000000000000000000000000000000000000000000000545950455f4944",
      hashType: "type",
      cellDeps: [],
    },
    [KnownScript.XUdt]: {
      codeHash:
        "0x50bd8d6680b8b9cf98b73f3c08faf8b2a21914311954118ad6609be6e78a1b95",
      hashType: "data1",
      cellDeps: [
        {
          cellDep: {
            outPoint: {
              txHash:
                "0xc07844ce21b38e4b071dd0e1ee3b0e27afd8d7532491327f39b786343f558ab7",
              index: 0,
            },
            depType: "code",
          },
        },
      ],
    },
    [KnownScript.JoyId]: {
      codeHash:
        "0xd00c84f0ec8fd441c38bc3f87a371f547190f2fcff88e642bc5bf54b9e318323",
      hashType: "type",
      cellDeps: [
        {
          cellDep: {
            outPoint: {
              txHash:
                "0xf05188e5f3a6767fc4687faf45ba5f1a6e25d3ada6129dae8722cb282f262493",
              index: 0,
            },
            depType: "depGroup",
          },
        },
      ],
    },
    [KnownScript.COTA]: {
      codeHash:
        "0x1122a4fb54697cf2e6e3a96c9d80fd398a936559b90954c6e88eb7ba0cf652df",
      hashType: "type",
      cellDeps: [
        {
          cellDep: {
            outPoint: {
              txHash:
                "0xabaa25237554f0d6c586dc010e7e85e6870bcfd9fb8773257ecacfbe1fd738a0",
              index: 0,
            },
            depType: "depGroup",
          },
        },
      ],
    },
    [KnownScript.PWLock]: {
      codeHash:
        "0xbf43c3602455798c1a61a596e0d95278864c552fafe231c063b3fabf97a8febc",
      hashType: "type",
      cellDeps: [
        {
          cellDep: {
            outPoint: {
              txHash:
                "0x71a7ba8fc96349fea0ed3a5c47992e3b4084b031a42264a018e0072e8172e46c",
              index: 0,
            },
            depType: "depGroup",
          },
        },
        {
          cellDep: {
            outPoint: {
              txHash:
                "0x1d60cb8f4666e039f418ea94730b1a8c5aa0bf2f7781474406387462924d15d4",
              index: 0,
            },
            depType: "code",
          },
          type: {
            codeHash:
              "0x00000000000000000000000000000000000000000000000000545950455f4944",
            hashType: "type",
            args: "0x42ade2f25eb938b5dbfd3d8f07b8b07aa593d848e7ff14bdfbbea5aeb6175261",
          },
        },
      ],
    },
    [KnownScript.OmniLock]: {
      codeHash:
        "0x9b819793a64463aed77c615d6cb226eea5487ccfc0783043a587254cda2b6f26",
      hashType: "type",
      cellDeps: [
        {
          cellDep: {
            outPoint: {
              txHash:
                "0x71a7ba8fc96349fea0ed3a5c47992e3b4084b031a42264a018e0072e8172e46c",
              index: 0,
            },
            depType: "depGroup",
          },
        },
        {
          cellDep: {
            outPoint: {
              txHash:
                "0xc76edf469816aa22f416503c38d0b533d2a018e253e379f134c3985b3472c842",
              index: 0,
            },
            depType: "code",
          },
          type: {
            codeHash:
              "0x00000000000000000000000000000000000000000000000000545950455f4944",
            hashType: "type",
            args: "0x855508fe0f0ca25b935b070452ecaee48f6c9f1d66cd15f046616b99e948236a",
          },
        },
      ],
    },
    [KnownScript.NostrLock]: {
      codeHash:
        "0x641a89ad2f77721b803cd50d01351c1f308444072d5fa20088567196c0574c68",
      hashType: "type",
      cellDeps: [
        {
          cellDep: {
            outPoint: {
              txHash:
                "0x1911208b136957d5f7c1708a8835edfe8ae1d02700d5cb2c3a6aacf4d5906306",
              index: 0,
            },
            depType: "code",
          },
          type: {
            codeHash:
              "0x00000000000000000000000000000000000000000000000000545950455f4944",
            hashType: "type",
            args: "0xfad8cb75eb0bb01718e2336002064568bc05887af107f74ed5dd501829e192f8",
          },
        },
      ],
    },
    [KnownScript.UniqueType]: {
      codeHash:
        "0x2c8c11c985da60b0a330c61a85507416d6382c130ba67f0c47ab071e00aec628",
      hashType: "data1",
      cellDeps: [
        {
          cellDep: {
            outPoint: {
              txHash:
                "0x67524c01c0cb5492e499c7c7e406f2f9d823e162d6b0cf432eacde0c9808c2ad",
              index: 0,
            },
            depType: "code",
          },
        },
      ],
    },
    [KnownScript.AlwaysSuccess]: {
      codeHash:
        "0x3b521cc4b552f109d092d8cc468a8048acb53c5952dbe769d2b2f9cf6e47f7f1",
      hashType: "data1",
      cellDeps: [
        {
          cellDep: {
            outPoint: {
              txHash:
                "0x10d63a996157d32c01078058000052674ca58d15f921bec7f1dcdac2160eb66b",
              index: 0,
            },
            depType: "code",
          },
        },
      ],
    },
    [KnownScript.InputTypeProxyLock]: {
      codeHash:
        "0x5123908965c711b0ffd8aec642f1ede329649bda1ebdca6bd24124d3796f768a",
      hashType: "data1",
      cellDeps: [
        {
          cellDep: {
            outPoint: {
              txHash:
                "0x10d63a996157d32c01078058000052674ca58d15f921bec7f1dcdac2160eb66b",
              index: 1,
            },
            depType: "code",
          },
        },
      ],
    },
    [KnownScript.OutputTypeProxyLock]: {
      codeHash:
        "0x2df53b592db3ae3685b7787adcfef0332a611edb83ca3feca435809964c3aff2",
      hashType: "data1",
      cellDeps: [
        {
          cellDep: {
            outPoint: {
              txHash:
                "0x10d63a996157d32c01078058000052674ca58d15f921bec7f1dcdac2160eb66b",
              index: 2,
            },
            depType: "code",
          },
        },
      ],
    },
    [KnownScript.LockProxyLock]: {
      codeHash:
        "0x5d41e32e224c15f152b7e6529100ebeac83b162f5f692a5365774dad2c1a1d02",
      hashType: "data1",
      cellDeps: [
        {
          cellDep: {
            outPoint: {
              txHash:
                "0x10d63a996157d32c01078058000052674ca58d15f921bec7f1dcdac2160eb66b",
              index: 3,
            },
            depType: "code",
          },
        },
      ],
    },
    [KnownScript.SingleUseLock]: {
      codeHash:
        "0x8290467a512e5b9a6b816469b0edabba1f4ac474e28ffdd604c2a7c76446bbaf",
      hashType: "data1",
      cellDeps: [
        {
          cellDep: {
            outPoint: {
              txHash:
                "0x10d63a996157d32c01078058000052674ca58d15f921bec7f1dcdac2160eb66b",
              index: 4,
            },
            depType: "code",
          },
        },
      ],
    },
    [KnownScript.TypeBurnLock]: {
      codeHash:
        "0xff78bae0abf17d7a404c0be0f9ad9c9185b3f88dcc60403453d5ba8e1f22f53a",
      hashType: "data1",
      cellDeps: [
        {
          cellDep: {
            outPoint: {
              txHash:
                "0x10d63a996157d32c01078058000052674ca58d15f921bec7f1dcdac2160eb66b",
              index: 5,
            },
            depType: "code",
          },
        },
      ],
    },
    [KnownScript.EasyToDiscoverType]: {
      codeHash:
        "0xaba4430cc7110d699007095430a1faa72973edf2322ddbfd4d1d219cacf237af",
      hashType: "data1",
      cellDeps: [
        {
          cellDep: {
            outPoint: {
              txHash:
                "0xb0ed754fb27d67fd8388c97fed914fb7998eceaa01f3e6f967e498de1ba0ac9b",
              index: 0,
            },
            depType: "code",
          },
        },
      ],
    },
    [KnownScript.TimeLock]: {
      codeHash:
        "0x6fac4b2e89360a1e692efcddcb3a28656d8446549fb83da6d896db8b714f4451",
      hashType: "data1",
      cellDeps: [
        {
          cellDep: {
            outPoint: {
              txHash:
                "0xb0ed754fb27d67fd8388c97fed914fb7998eceaa01f3e6f967e498de1ba0ac9b",
              index: 1,
            },
            depType: "code",
          },
        },
      ],
    },
  });
