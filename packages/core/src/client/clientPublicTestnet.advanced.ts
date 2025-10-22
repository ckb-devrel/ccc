import { ScriptInfoLike } from "./clientTypes.js";
import { KnownScript } from "./knownScript.js";

export const TESTNET_SCRIPTS: Record<KnownScript, ScriptInfoLike> =
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
                "0x8f8c79eb6671709633fe6a46de93c0fedc9c1b8a6527a18d3983879542635c9f",
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
                "0xf8de3bb47d055cdf460d93a2a6e1b05f7432f9777c8c474abf4eec1d4aee5d37",
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
                "0xf8de3bb47d055cdf460d93a2a6e1b05f7432f9777c8c474abf4eec1d4aee5d37",
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
                "0x2eefdeb21f3a3edf697c28a52601b4419806ed60bb427420455cc29a090b26d5",
              index: 0,
            },
            depType: "depGroup",
          },
        },
      ],
    },
    [KnownScript.AnyoneCanPay]: {
      codeHash:
        "0x3419a1c09eb2567f6552ee7a8ecffd64155cffe0f1796e6e61ec088d740c1356",
      hashType: "type",
      cellDeps: [
        {
          cellDep: {
            outPoint: {
              txHash:
                "0xec26b0f85ed839ece5f11c4c4e837ec359f5adc4420410f6453b1f6b60fb96a6",
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
        "0x25c29dc317811a6f6f3985a7a9ebc4838bd388d19d0feeecf0bcd60f6c0975bb",
      hashType: "type",
      cellDeps: [
        {
          cellDep: {
            outPoint: {
              txHash:
                "0xbf6fb538763efec2a70a6a3dcb7242787087e1030c4e7d86585bc63a9d337f5f",
              index: 0,
            },
            depType: "code",
          },
          type: {
            codeHash:
              "0x00000000000000000000000000000000000000000000000000545950455f4944",
            hashType: "type",
            args: "0x44ec8b96663e06cc94c8c468a4d46d7d9af69eaf418f6390c9f11bb763dda0ae",
          },
        },
      ],
    },
    [KnownScript.JoyId]: {
      codeHash:
        "0xd23761b364210735c19c60561d213fb3beae2fd6172743719eff6920e020baac",
      hashType: "type",
      cellDeps: [
        {
          cellDep: {
            outPoint: {
              txHash:
                "0x4a596d31dc35e88fb1591debbf680b04a44b4a434e3a94453c21ea8950ffb4d9",
              index: 0,
            },
            depType: "code",
          },
          type: {
            codeHash:
              "0x00000000000000000000000000000000000000000000000000545950455f4944",
            hashType: "type",
            args: "0x1c9fc299ba0570d077b4d7fb9acff1ccc0de69d369942d82678bae937c44ec30",
          },
        },
        {
          cellDep: {
            outPoint: {
              txHash:
                "0x4a596d31dc35e88fb1591debbf680b04a44b4a434e3a94453c21ea8950ffb4d9",
              index: 1,
            },
            depType: "code",
          },
          type: {
            codeHash:
              "0x00000000000000000000000000000000000000000000000000545950455f4944",
            hashType: "type",
            args: "0x27f0d3ccdc2fcd52ae31fbacad5f86b97bc147d7093e4807cd6e3d21c1fe6841",
          },
        },
        {
          cellDep: {
            outPoint: {
              txHash:
                "0xf2c9dbfe7438a8c622558da8fa912d36755271ea469d3a25cb8d3373d35c8638",
              index: 1,
            },
            depType: "code",
          },
          type: {
            codeHash:
              "0x00000000000000000000000000000000000000000000000000545950455f4944",
            hashType: "type",
            args: "0x0ac15fe5b2d059ec39de03f2d3159d5463abb918a1a07a9fa00d2b9c61d89ef3",
          },
        },
        {
          cellDep: {
            outPoint: {
              txHash:
                "0x95ecf9b41701b45d431657a67bbfa3f07ef7ceb53bf87097f3674e1a4a19ce62",
              index: 1,
            },
            depType: "code",
          },
          type: {
            codeHash:
              "0x00000000000000000000000000000000000000000000000000545950455f4944",
            hashType: "type",
            args: "0xc7bafc5550ccad7cea32c27764f5df6aca4de547da65e3e67fa08477a1af7f5e",
          },
        },
        {
          cellDep: {
            outPoint: {
              txHash:
                "0x8b3255491f3c4dcc1cfca33d5c6bcaec5409efe4bbda243900f9580c47e0242e",
              index: 1,
            },
            depType: "code",
          },
          type: {
            codeHash:
              "0x00000000000000000000000000000000000000000000000000545950455f4944",
            hashType: "type",
            args: "0x71decef9ca8725e64ec99a5521790d16b8d5daadb4989b45dd6ab51806a8c0e4",
          },
        },
      ],
    },
    [KnownScript.COTA]: {
      codeHash:
        "0x89cd8003a0eaf8e65e0c31525b7d1d5c1becefd2ea75bb4cff87810ae37764d8",
      hashType: "type",
      cellDeps: [
        {
          cellDep: {
            outPoint: {
              txHash:
                "0x636a786001f87cb615acfcf408be0f9a1f077001f0bbc75ca54eadfe7e221713",
              index: 0,
            },
            depType: "depGroup",
          },
        },
      ],
    },
    [KnownScript.PWLock]: {
      codeHash:
        "0x58c5f491aba6d61678b7cf7edf4910b1f5e00ec0cde2f42e0abb4fd9aff25a63",
      hashType: "type",
      cellDeps: [
        {
          cellDep: {
            outPoint: {
              txHash:
                "0xf8de3bb47d055cdf460d93a2a6e1b05f7432f9777c8c474abf4eec1d4aee5d37",
              index: 0,
            },
            depType: "depGroup",
          },
        },
        {
          cellDep: {
            outPoint: {
              txHash:
                "0x57a62003daeab9d54aa29b944fc3b451213a5ebdf2e232216a3cfed0dde61b38",
              index: 0,
            },
            depType: "code",
          },
          type: {
            codeHash:
              "0x00000000000000000000000000000000000000000000000000545950455f4944",
            hashType: "type",
            args: "0xf6d90bfe3041d0fd7e01c45770241697f5f837974bd6ae1672a7ec0f9f523268",
          },
        },
      ],
    },
    [KnownScript.OmniLock]: {
      codeHash:
        "0xf329effd1c475a2978453c8600e1eaf0bc2087ee093c3ee64cc96ec6847752cb",
      hashType: "type",
      cellDeps: [
        {
          cellDep: {
            outPoint: {
              txHash:
                "0xf8de3bb47d055cdf460d93a2a6e1b05f7432f9777c8c474abf4eec1d4aee5d37",
              index: 0,
            },
            depType: "depGroup",
          },
        },
        {
          cellDep: {
            outPoint: {
              txHash:
                "0xec18bf0d857c981c3d1f4e17999b9b90c484b303378e94de1a57b0872f5d4602",
              index: 0,
            },
            depType: "code",
          },
          type: {
            codeHash:
              "0x00000000000000000000000000000000000000000000000000545950455f4944",
            hashType: "type",
            args: "0x761f51fc9cd6a504c32c6ae64b3746594d1af27629b427c5ccf6c9a725a89144",
          },
        },
      ],
    },
    [KnownScript.NostrLock]: {
      codeHash:
        "0x6ae5ee0cb887b2df5a9a18137315b9bdc55be8d52637b2de0624092d5f0c91d5",
      hashType: "type",
      cellDeps: [
        {
          cellDep: {
            outPoint: {
              txHash:
                "0xa2a434dcdbe280b9ed75bb7d6c7d68186a842456aba0fc506657dc5ed7c01d68",
              index: 0,
            },
            depType: "code",
          },
          type: {
            codeHash:
              "0x00000000000000000000000000000000000000000000000000545950455f4944",
            hashType: "type",
            args: "0x8dc56c6f35f0c535e23ded1629b1f20535477a1b43e59f14617d11e32c50e0aa",
          },
        },
      ],
    },
    [KnownScript.UniqueType]: {
      codeHash:
        "0x8e341bcfec6393dcd41e635733ff2dca00a6af546949f70c57a706c0f344df8b",
      hashType: "type",
      cellDeps: [
        {
          cellDep: {
            outPoint: {
              txHash:
                "0xff91b063c78ed06f10a1ed436122bd7d671f9a72ef5f5fa28d05252c17cf4cef",
              index: 0,
            },
            depType: "code",
          },
          type: {
            codeHash:
              "0x00000000000000000000000000000000000000000000000000545950455f4944",
            hashType: "type",
            args: "0xe04976b67600fd25ac50305f77b33aee2c12e3c18e63ece9119e5b32117884b5",
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
                "0xb4f171c9c9caf7401f54a8e56225ae21d95032150a87a4678eac3f66a3137b93",
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
                "0xb4f171c9c9caf7401f54a8e56225ae21d95032150a87a4678eac3f66a3137b93",
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
                "0xb4f171c9c9caf7401f54a8e56225ae21d95032150a87a4678eac3f66a3137b93",
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
                "0xb4f171c9c9caf7401f54a8e56225ae21d95032150a87a4678eac3f66a3137b93",
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
                "0xb4f171c9c9caf7401f54a8e56225ae21d95032150a87a4678eac3f66a3137b93",
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
                "0xb4f171c9c9caf7401f54a8e56225ae21d95032150a87a4678eac3f66a3137b93",
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
                "0x1b4ffcad55ecd36ffb2715b6816b83da73851f1a24fe594f263c4f34dad90792",
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
                "0x1b4ffcad55ecd36ffb2715b6816b83da73851f1a24fe594f263c4f34dad90792",
              index: 1,
            },
            depType: "code",
          },
        },
      ],
    },
  });
