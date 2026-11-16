import { SigningAlg, verifyCredential } from "@joyid/ckb";
import { p256 } from "@noble/curves/nist.js";
import {
  createHash,
  createPublicKey,
  generateKeyPairSync,
  sign,
  verify,
} from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { bytesFrom } from "../../bytes/index.js";
import { ClientPublicTestnet } from "../../client/index.js";
import { Signer, SignerSignType, SignerType } from "../signer/index.js";
import { verifyMessageJoyId } from "./verifyJoyId.js";

vi.mock("@joyid/ckb", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@joyid/ckb")>()),
  verifyCredential: vi.fn(),
}));

beforeEach(() => {
  vi.mocked(verifyCredential).mockReset().mockResolvedValue(true);
});

// Signatures of "Sign this for me" from joyid-sdk-js packages/ckb/fixtures,
// with signature and message in base64url as the JoyID popup returns them.
// Source: nervina-labs/joyid-sdk-js@5f25794006dca5276f6b1f287aa81b460bd9af78.
// These are text fixtures; they do not establish binary/isData compatibility.
const FIXTURES = [
  {
    name: "r1_mainkey",
    keyType: "main_key",
    publicKey:
      "225644b369b4814011963d6f60624099eca92c17a0d48599e6c60d32caf178e002068e7e033cd203f1e31372a9f1fe0fcd416de1624778cccaf6a8de92478327",
    signature: JSON.stringify({
      signature:
        "MEUCIBMs27VuA0364WWdwsJyadDo-95aw6qhz-qxrafKVWKbAiEAmcOhMA72IW7J7n9tgVhZQJg6RNE_DFsRPyBP565FRbI",
      alg: -7,
      message:
        "tsBioX2KQw2UE__BCh4dM4mUPOrdilxf7SOATr8TCModAAAAAHsidHlwZSI6IndlYmF1dGhuLmdldCIsImNoYWxsZW5nZSI6IlUybG5iaUIwYUdseklHWnZjaUJ0WlEiLCJvcmlnaW4iOiJodHRwczovL2pveWlkLWFwcC1naXQtZmVhdC1yZW1vdmUtbmFtZS1uZXJ2aW5hLnZlcmNlbC5hcHAifQ",
    }),
  },
  {
    name: "r1_subkey",
    keyType: "sub_key",
    publicKey:
      "d1f1b2adc863d72d3df248a5a8263d234dff0b06c1042e8931db2bbd83ab1652791c020725ea4f2088eda7c9bff51736d74ae0b0e7fbdfccd7a61c908eba7627",
    signature: JSON.stringify({
      signature:
        "MEYCIQDVO8vNgFrGAIqk_myFDRNmLk9e3hDqx4AjXRf1ByBsEQIhAJqIR9gcd34nN6wTqJHLBp1M1dfKXN5qczfBSDUPNaj0",
      alg: -7,
      message:
        "tsBioX2KQw2UE__BCh4dM4mUPOrdilxf7SOATr8TCMoFAAAACHsidHlwZSI6IndlYmF1dGhuLmdldCIsImNoYWxsZW5nZSI6IlUybG5iaUIwYUdseklHWnZjaUJ0WlEiLCJvcmlnaW4iOiJodHRwczpcL1wvam95aWQtYXBwLWdpdC1mZWF0LXJlbW92ZS1uYW1lLW5lcnZpbmEudmVyY2VsLmFwcCIsImFuZHJvaWRQYWNrYWdlTmFtZSI6ImNvbS5hbmRyb2lkLmNocm9tZSJ9",
    }),
  },
  {
    name: "rsa_mainkey",
    keyType: "main_key",
    publicKey:
      "01000100990405b0583fe4cb88f43e6997231f7598ee435eab83392b0afd172ffd29d69b5d30e740a892317eca46802527575ea87cb2a309a6d48f473332c64d08c6c0147a9bfa1c09b1f993ebab6885c29163d483a7564814ffca07928676e20b13317ae856588a1933e3e44f4a09d4c4754a9a85e5ebf6528d1c83c6ebdf716bc80ddc016d597c466d34471a1fc2c8918915e93d1aef4c92b2317b8cff8789f00633b552bba6ad09090a834ca552bebda7af1615d3900de2868c2a99159c73a6401073ce0780a4a27bc648c7b2d3e572412e7bf9dcc89824b48db16a0211b97c950b78dd52545c41f48b1f36ba7bf562d0a5518ec8ff707a94adc2ebe0770b364bc8b5",
    signature: JSON.stringify({
      signature:
        "HCZoy5Lw3EI-2MdBlyBhzejtL7R1EyCEGK97JAnyuHhjxHhy0IbWHy1JdMhZzqesbDA81pVnz1yELRUB8hdXLy8NrAP0AdcNjBYg6sH1w_TW7uNj6Yj5MTSxa_P7eza0iad_S1YNG2Xd4FGUMUrc2Gml8EbSwhEq0Jh8qciP61UhHSQ77qif5LfuFQCVpdA_lt1RKpaSvvPUbJcbW2XxHgwJhZs8yDMm3L0tvedbinkrS_KgjheOem2ezQXS-_73NvH_M9N_Cdf-mMoza2om4nQzuXyOojJ9oLze1wltfTb_XtErFdSh9fcfEJ2FOoaAUH5EWt6_jWBZniH6T3kNcQ",
      alg: -257,
      message:
        "tsBioX2KQw2UE__BCh4dM4mUPOrdilxf7SOATr8TCMoFAAAABXsidHlwZSI6IndlYmF1dGhuLmdldCIsImNoYWxsZW5nZSI6IlUybG5iaUIwYUdseklHWnZjaUJ0WlEiLCJvcmlnaW4iOiJodHRwczovL2pveWlkLWFwcC1naXQtZmVhdC1yZW1vdmUtbmFtZS1uZXJ2aW5hLnZlcmNlbC5hcHAiLCJjcm9zc09yaWdpbiI6ZmFsc2V9",
    }),
  },
  {
    name: "rsa_subkey",
    keyType: "sub_key",
    publicKey:
      "0100010065da07fe77dd684ed0d0c0b4b5f24f6a9ea5e5761369529770e7fcf528780d3a3ec375a2e1e68ea962b96963444d9f5ab6bb6918285e61f5056cd6829a9094b4cc5b4625f966fb706819e9d86036b321d4ad8a7954e4da39022419c4c964f0078043c0d1f95f3ebba1f740ea996ce5439bfb663b403426ed70c83d7ee51a60243eca8cb17332f12c918731eb35a5b989f257b12b4171ebeb8713606ab5bd17c00f6c145770b44f4e1b768de267f9f2ab62eab13b3db2121c3f425f9a2c4197619e62d94897e255e5fb26b31e5a79cfbac4b919c438a1b3200fbd0ee7b03f2142d6d059e9da3159391b4fdb4588fd56774b97a774f4ba58450a634b059ac265c3",
    signature: JSON.stringify({
      signature:
        "P9h639bbzRh90N_HQ3rrTilJ3GMWOcWqMwqUFIxWuNxTGEiQGvX_uQnWbyZa93-s7GTBuSmCAuO6lyFNOdZ4Jz7YQEHmF4Wj80wLootLOz_P-DeXxJ_YrR2k-wisHN-1GYN5QDD-i7rkyvcubtftVJkYz1075vqYpRMaTXUQIwa3U7_7b3d7etw1ecNhxYodE3-7rrkTC-KNLNhTPlE4CGIdzUOFu6ZFrMLdgDSk3zocyVRGvl6XnnikBgG1p-U4deP0CZfvoc3L84k0qewIlVeU_YkAa6gkqJQxAVGXRZyvja80e8SM3uS6i0mK2ZA9FI5Fh-eMsdn-8XDKQ0gtog",
      alg: -257,
      message:
        "tsBioX2KQw2UE__BCh4dM4mUPOrdilxf7SOATr8TCMoFAAAABHsidHlwZSI6IndlYmF1dGhuLmdldCIsImNoYWxsZW5nZSI6IlUybG5iaUIwYUdseklHWnZjaUJ0WlEiLCJvcmlnaW4iOiJodHRwczovL2pveWlkLWFwcC1naXQtZmVhdC1yZW1vdmUtbmFtZS1uZXJ2aW5hLnZlcmNlbC5hcHAiLCJjcm9zc09yaWdpbiI6ZmFsc2V9",
    }),
  },
  {
    name: "r1_main_session_key",
    keyType: "main_session_key",
    publicKey:
      "0100010015bae3278559de7b25acc42361b0ae517775e85dc9d70f681741ab2f03aa808c57e5586052b47147015b6fa53e7a3dbfbe0efc2281de40109581457c9f70d402fffe9cf9a032f3802b00e9bd2148a5f74cf02019ebdb560bb365d0ade3eded339b86cbff7ff52f9e4559d70bee4d0e2399ce79c2c766b89fb92fa2e8e146d28d055ff1184e3c46d98e0dcad34f4e9e4656619bf3a8f9a832113e948ce84718ad1cc504d42febe07f57359d89718182728e62017adb8d145e84a9ad72ca9e64f96d012c9d5420258436e60ca6589d4523798ae727105f301028f4232c83a3aaf404c20cbdc29b4be02af73d16853b2ba4ce1beaf4ec4fe614b46ac506f842adac",
    signature: JSON.stringify({
      signature:
        "qhD1Kvkwgy9Uj8-2TQkBsckYUf735-MTGbUiSCvNTjq70NpvgYKyhapnntKWG9rCg6ZAD3hKkJ-Ackd4glr0PAjroNWoVVqaCMi-VkQDlzfRRMBZ2ptMYwkZVNrUtkt8PfVPUWJPGWnvbzUpvKHikxakKprT4GX2scYVq7hos7kM_d0VIve_VFI2noWa7g-WKl7VbCNw8RhM-3cvcajfmiEkW9EWqf1l-Q9_mumI6LPs6Jtd1Kb5dUyxOk2OGqNBkiY9XiUDsMUrP8XXagBc7NBV4J12CFSqDaFKZzuJW8Kh0Dus-MqmSIlo2u4yQFwDsxA6G8gUndoatMAaV1kpKQ",
      alg: -7,
      message: "U2lnbiB0aGlzIGZvciBtZQ",
    }),
  },
  {
    name: "r1_sub_session_key",
    keyType: "sub_session_key",
    publicKey:
      "01000100b76e32841fb30c7e2c2f231567da6e6a32b504115b31436f976d0f9bdd14615d0e1e5b6ce03a369bbe7cbdd09d4f5323a19641abe98f5280d1941f2a15e4bac655bf93fbce25de71b50b28319dbdb1c47190dd67418b104bdf6f4e0337d7e627ba16cb59dc3bddd125e87ff49cc6542600a7e15fa1ef6217b70dc02a6a8562bb7ee7fcf182f9483eb425580443560ffa49e8206cf940421d88a09efe7f98325829e9851b57aa01821e99b54054e1d6b72bf96415a95c8d7a2253b559263e65abda831c6fd31df69e6c2078e4f6db9af507a9b2bf791c7e9d72258cbaddc51a38a44ec22862ca3b8eb7b1738d7df0a8f6f2ef02331b57a8a17ef8d8bb314141c6",
    signature: JSON.stringify({
      signature:
        "ceUI6EkB-0F5FBZZW1IDSVezZ_p8L_GMlEh45Bq6AShE5zocwZ6PY16QbTQQUQG9VH9hu5mCCuQPJO9jD9DtzOylyApzzW24TLNOFJPetO9mv0jlrbEhVOkYlfS5dBsxwzPk6Yk7FWTNl95POLQM4ehdGBE16rgxCc8M1UtquTXsJGNGqIQ3HtOJkYn1kckkcvYPsiytFLohlNcylLyhY3uQzU_rOjAItGd_xZ_fkJKoC5ov5yglnYtiIoItrWNteyEmZQRjDQMGvBI8meAuTREbP95s_Z2L50j5WepcQQSwImdKcBxBaCCiTyGlxgumJffqAQJBFdSvH67pGLAR3g",
      alg: -7,
      message: "U2lnbiB0aGlzIGZvciBtZQ",
    }),
  },
  {
    name: "rsa_main_session_key",
    keyType: "main_session_key",
    publicKey:
      "010001009916d8ab9e09f402c81391c6ffa84d1fa111fed3c3c4356fb52bd11d679d6ceb25059ab2669cfc43c7e26306aed3769f12c87f5557b23263da912eb805c2f2deb66606cf5e2835eb5cbf1d753739807c39c9dc134b1cd55c750520891808e7da6f9974a900500812b17e96b10549556bd646e86861c43c68baf7b15b053e71584a6499e8b31db7a36784418cd7041716f84a0ce37d45dcf32279da36ed96bcb70d36e9fc2bda81c297169b7e14640073ab970738292bfac39d4ab5e8be7c20a80b13d77678d86b451d4fee87470fd88b0c98be60755777c711ca54d9e6b598c850990cec963f44d7b925ed247e81921c503067e2b8b57a40969a0216afab6cb6",
    signature: JSON.stringify({
      signature:
        "lzQXIygf0Em5FZG69OPZ3gK6HA6DbfpH6VMIEIXbEh_trNuk55IgGu_eoU50AMr1cfIpta5ZUZXQdj5zoZ8JJ0p73KfLESnhZBn9gevo2RdigMu0HXpCGXQm7xgQbkCjzTP9u36yeKYGwXXG96w0HAX41tUJhEHQnxHrWn6f1sIcJq-paPU5C72sQQgntMtLO1-6YxMoWKPHijAePn6Z7X0RA__TIcI4PD4eBKhqxdB-okhMjnSxT4-pCBuCWbYd2fVbahmTdiSDMKnMj4QvfLnKuV8vLGsPn1SIhNy62D9tcQd1E8VzqLC0Z-IVTMNI8wqm6LMvJk-ivHiF_EiHYg",
      alg: -257,
      message: "U2lnbiB0aGlzIGZvciBtZQ",
    }),
  },
  {
    name: "rsa_sub_session_key",
    keyType: "sub_session_key",
    publicKey:
      "01000100e7e85703bd35d58be0a9748a07b57a6fee552439ed75bb82d59584a9bb8cb2d70b563e0dff211d22b59ebd80825363a7d17ca596e39db3c428e2e7e3067d6df0349276aa4fa2d3f02a50081749907210e39596e50c6d09472da62e366490a6622723549eb30f8d38fd5aefa26c9d1c666287372ec96d01131205f2f9f98f73705df27efb4f59fb3ad53c12797d621632e457f2d7b51d45268706c9653f1412c528818112d6a76512c76d2628d8ec36117bc562e8311d6731a650bc09e4323ae839a172b4be61818780ba5e39bfc5b208710fc2a547fd59269c102685c39ccc0ac31ca3c25aecc626b807673b2d07a0f239384192270355ba50d277f6b16ed4d0",
    signature: JSON.stringify({
      signature:
        "XvgU6WCw5aNoRp2o2yFzsZYTgIGFkVn--IQX9NVEu-jDXUpAUoqQ6E9YmEYhq-OwQj6DIG0E1vAS0VDNRXRIp-8xcOHSnAkO7n8kYDqK-dhaDjYREBqsL3zbImhMxCL4VGRq3jWHMUq5LldwkJxSRM6o9OiEvGv_Uj7Apsq3qjE_9x8Db-RHAXmzd_PjqRvSPcLDET47bQ83G2ItkDW8od7y8145yDLwDhfhxji5GtgDGl2d9fhGTR_XIboJiAibnh46kQ9a-yzMAtA3iWCBuZQblb_WC1FKSyRNH9My7O_4ekACjV1R3gBjzWVPw7Bz8VYTJfuHD4NryaQmlWKkqQ",
      alg: -257,
      message: "U2lnbiB0aGlzIGZvciBtZQ",
    }),
  },
];

const MESSAGE = "Sign this for me";
const SESSION_FIXTURES = FIXTURES.filter((f) =>
  f.keyType.endsWith("_session_key"),
);

const BINARY_MESSAGE = Uint8Array.from([0, 1, 2, 0x7f, 0x80, 0xfe, 0xff]);
// Real testnet main_key capture supplied in this private task on 2026-10-17.
// This is evidence for main_key only, not sub_key or either session key type.
const BINARY_FIXTURE = {
  name: "testnet_binary_main_key",
  keyType: "main_key",
  publicKey:
    "a4a1ce0ccecd6816fa646d46ec15d7f5cc19e3ffbf878707ba9c865d58b05b41403a4217b61d796f266eb331e1b5bf4b522b20cb2ecb5341b8af4305a3772dc2",
  signature: JSON.stringify({
    signature:
      "MEUCIQDvyZQTVF3xqUtpLlYXsCyM_WzkyG8-bCUHlQgH3oiyTQIgOtIjpFd85rXgWwEamVWg5snpCKBzTKftDMU2OlSi1sE",
    alg: -7,
    message:
      "K4sF4fAwPvuJj-TW3mARmMenuGSrvmohxzsueH4YfFIdAAAAAHsidHlwZSI6IndlYmF1dGhuLmdldCIsImNoYWxsZW5nZSI6IkFBRUNmNEQtX3ciLCJvcmlnaW4iOiJodHRwczovL3Rlc3RuZXQuam95aWQuZGV2IiwiY3Jvc3NPcmlnaW4iOmZhbHNlfQ",
  }),
};

// Real testnet sub_key capture supplied on 2026-10-19 via @ckb-ccc/playground:
// signer.getIdentity() and signer.signMessage(Uint8Array.from(BINARY_MESSAGE)).
const BINARY_SUBKEY_FIXTURE = {
  name: "testnet_binary_sub_key",
  keyType: "sub_key",
  publicKey:
    "8e57e63781adb052ba7cc93a98b697102b74f11f268cb413eb731cb478b2d2deb367eb4d11c04a8e976475c2b165d9733206d70b518fbf43b4fa37de1f797b6e",
  signature: JSON.stringify({
    signature:
      "MEUCIQD04g6l_8IxlR8j624TOQn3e8ldwR0wBqvOtUrXUDuukgIgD6f58Dhj8svDP4_d9MQifdrtPOGM9TiumJ_EAdJr-F8",
    alg: -7,
    message:
      "K4sF4fAwPvuJj-TW3mARmMenuGSrvmohxzsueH4YfFIdAAAAAHsidHlwZSI6IndlYmF1dGhuLmdldCIsImNoYWxsZW5nZSI6IkFBRUNmNEQtX3ciLCJvcmlnaW4iOiJodHRwczovL3Rlc3RuZXQuam95aWQuZGV2IiwiY3Jvc3NPcmlnaW4iOmZhbHNlfQ",
  }),
};

// Synthetic WebAuthn packets exercise both algorithms and passkey dispatch.
// They are unit tests, not captures or evidence of sub_key wallet compatibility.
function syntheticBinaryPasskey(
  rsa: boolean,
  message: string | Uint8Array = BINARY_MESSAGE,
): (typeof FIXTURES)[number] {
  const pair = rsa
    ? generateKeyPairSync("rsa", { modulusLength: 2048 })
    : generateKeyPairSync("ec", { namedCurve: "prime256v1" });
  const jwk = pair.publicKey.export({ format: "jwk" });
  const publicKey = rsa
    ? Buffer.concat([
        Buffer.from(jwk.e!, "base64url").reverse(),
        Buffer.alloc(1),
        Buffer.from(jwk.n!, "base64url").reverse(),
      ]).toString("hex")
    : Buffer.concat([
        Buffer.from(jwk.x!, "base64url"),
        Buffer.from(jwk.y!, "base64url"),
      ]).toString("hex");
  const clientData = Buffer.from(
    JSON.stringify({
      type: "webauthn.get",
      challenge: Buffer.from(message).toString("base64url"),
      origin: "https://synthetic.test",
    }),
  );
  const authData = Buffer.alloc(37);
  const signatureBase = Buffer.concat([
    authData,
    createHash("sha256").update(clientData).digest(),
  ]);
  return {
    name: rsa ? "synthetic_RSA" : "synthetic_P256",
    keyType: "main_key",
    publicKey,
    signature: JSON.stringify({
      signature: sign("sha256", signatureBase, pair.privateKey).toString(
        "base64url",
      ),
      message: Buffer.concat([authData, clientData]).toString("base64url"),
      alg: rsa ? -257 : -7,
    }),
  };
}

function identity(fixture: (typeof FIXTURES)[number]): string {
  return JSON.stringify({
    address: "ckt1fixture",
    keyType: fixture.keyType,
    publicKey: fixture.publicKey,
  });
}

function withFields(signature: string, fields: object): string {
  return JSON.stringify({
    ...(JSON.parse(signature) as object),
    ...fields,
  });
}

function fixture(name: string): (typeof FIXTURES)[number] {
  const found = FIXTURES.find((f) => f.name === name);
  if (!found) {
    throw new Error(`No fixture ${name}`);
  }
  return found;
}

// Exercise the inherited verification boundary without a wallet or RPC access.
class FixtureSigner extends Signer {
  constructor(private readonly trustedIdentity: string) {
    super(
      ClientPublicTestnet.new({
        transport: {
          request: async () => {
            throw new Error("Unexpected RPC request");
          },
        },
      }),
    );
  }

  get type() {
    return SignerType.CKB;
  }
  get signType() {
    return SignerSignType.JoyId;
  }
  async getIdentity() {
    return this.trustedIdentity;
  }
  async connect() {}
  async isConnected() {
    return true;
  }
  async getInternalAddress(): Promise<never> {
    throw new Error("Unexpected address request");
  }
  async getAddressObjs(): Promise<never> {
    throw new Error("Unexpected address request");
  }
}

describe("verifyMessageJoyId", () => {
  it.each(FIXTURES)("verifies $name", async (f) => {
    expect(await verifyMessageJoyId(MESSAGE, f.signature, identity(f))).toBe(
      true,
    );
  });

  it.each(FIXTURES)("rejects $name for another message", async (f) => {
    expect(
      await verifyMessageJoyId("Another message", f.signature, identity(f)),
    ).toBe(false);
  });

  it("ignores a public key and key type in the signature", async () => {
    const signer = fixture("rsa_main_session_key");
    const signature = withFields(signer.signature, {
      pubkey: signer.publicKey,
      keyType: signer.keyType,
    });

    expect(
      await verifyMessageJoyId(
        MESSAGE,
        signature,
        identity(fixture("r1_mainkey")),
      ),
    ).toBe(false);
  });

  describe.each(
    [
      "other",
      "MAIN_KEY",
      "main_session_key ",
      "",
      null,
      undefined,
      0,
      false,
      ["main_session_key"],
      {},
    ].map((keyType) => ({
      keyType,
      label: JSON.stringify(keyType) ?? "missing",
    })),
  )("unsupported key type $label", ({ keyType }) => {
    it.each(FIXTURES)(
      "rejects $name even for the signed message",
      async (f) => {
        const unsupported = JSON.stringify({
          keyType,
          publicKey: f.publicKey,
        });
        const signature = withFields(f.signature, { keyType: f.keyType });

        expect(await verifyMessageJoyId(MESSAGE, signature, unsupported)).toBe(
          false,
        );
      },
    );
  });

  it.each(FIXTURES)("ignores a challenge in the $name signature", async (f) => {
    const signature = withFields(f.signature, { challenge: MESSAGE });

    expect(
      await verifyMessageJoyId("Another message", signature, identity(f)),
    ).toBe(false);
  });

  it.each(FIXTURES)(
    "reads the $name algorithm from the public key",
    async (f) => {
      for (const alg of [-7, -257, 0, null, undefined]) {
        const signature = withFields(f.signature, { alg });

        expect(await verifyMessageJoyId(MESSAGE, signature, identity(f))).toBe(
          true,
        );
      }
    },
  );

  it.each(FIXTURES)(
    "ignores identity fields in the $name response",
    async (f) => {
      const signature = withFields(f.signature, {
        pubkey: "00".repeat(64),
        publicKey: "00".repeat(64),
        keyType: "other",
        challenge: "Another message",
      });

      expect(await verifyMessageJoyId(MESSAGE, signature, identity(f))).toBe(
        true,
      );
    },
  );

  it.each(FIXTURES)("rejects $name with a different trusted key", async (f) => {
    const other = FIXTURES.find(
      (candidate) =>
        candidate.publicKey !== f.publicKey &&
        candidate.publicKey.length === f.publicKey.length,
    )!;
    const signature = withFields(f.signature, { pubkey: f.publicKey });

    expect(
      await verifyMessageJoyId(
        MESSAGE,
        signature,
        JSON.stringify({ keyType: f.keyType, publicKey: other.publicKey }),
      ),
    ).toBe(false);
  });

  it.each(SESSION_FIXTURES)(
    "binds $name to the caller's challenge despite a replaced response message",
    async (f) => {
      const signature = withFields(f.signature, { message: "AA" });

      expect(await verifyMessageJoyId(MESSAGE, signature, identity(f))).toBe(
        true,
      );
      expect(
        await verifyMessageJoyId("Another message", signature, identity(f)),
      ).toBe(false);
    },
  );

  it.each(SESSION_FIXTURES)(
    "does not let $name select session verification for a trusted passkey type",
    async (f) => {
      for (const keyType of ["main_key", "sub_key"]) {
        const signature = withFields(f.signature, { keyType: f.keyType });

        expect(
          await verifyMessageJoyId(
            MESSAGE,
            signature,
            JSON.stringify({ keyType, publicKey: f.publicKey }),
          ),
        ).toBe(false);
      }
    },
  );

  it.each(FIXTURES)(
    "preserves caller binding through Signer for $name",
    async (f) => {
      const signature = {
        signType: SignerSignType.JoyId,
        identity: identity(f),
        signature: withFields(f.signature, { challenge: MESSAGE }),
      };

      expect(await Signer.verifyMessage(MESSAGE, signature)).toBe(true);
      expect(await Signer.verifyMessage("Another message", signature)).toBe(
        false,
      );
    },
  );

  it.each(FIXTURES)(
    "uses the signer's trusted identity for $name",
    async (f) => {
      const signer = new FixtureSigner(identity(f));
      const other = FIXTURES.find(
        (candidate) => candidate.publicKey !== f.publicKey,
      )!;
      const injected = withFields(other.signature, {
        pubkey: other.publicKey,
        keyType: other.keyType,
        challenge: MESSAGE,
      });

      expect(await signer.verifyMessage(MESSAGE, f.signature)).toBe(true);
      expect(await signer.verifyMessage(MESSAGE, injected)).toBe(false);
      expect(
        await signer.verifyMessage(MESSAGE, {
          signType: SignerSignType.JoyId,
          identity: identity(other),
          signature: other.signature,
        }),
      ).toBe(false);
      expect(await signer.verifyMessage("Another message", f.signature)).toBe(
        false,
      );
    },
  );
});

const BINARY_FIXTURES = [BINARY_FIXTURE, BINARY_SUBKEY_FIXTURE];

describe.each(BINARY_FIXTURES)("binary passkeys: $name", (f) => {
  it("independently verifies the captured signature and raw challenge", () => {
    const data = JSON.parse(f.signature) as {
      signature: string;
      message: string;
    };
    const payload = Buffer.from(data.message, "base64url");
    const clientData = payload.subarray(37);
    expect(JSON.parse(clientData.toString())).toMatchObject({
      challenge: Buffer.from(BINARY_MESSAGE).toString("base64url"),
    });
    const publicKey = createPublicKey({
      format: "jwk",
      key: {
        kty: "EC",
        crv: "P-256",
        x: Buffer.from(f.publicKey.slice(0, 64), "hex").toString("base64url"),
        y: Buffer.from(f.publicKey.slice(64), "hex").toString("base64url"),
      },
    });
    expect(
      verify(
        "sha256",
        Buffer.concat([
          payload.subarray(0, 37),
          createHash("sha256").update(clientData).digest(),
        ]),
        publicKey,
        Buffer.from(data.signature, "base64url"),
      ),
    ).toBe(true);
  });

  it.each([
    { name: "Uint8Array", input: BINARY_MESSAGE },
    { name: "ArrayBuffer", input: BINARY_MESSAGE.slice().buffer },
    { name: "number array", input: Array.from(BINARY_MESSAGE) },
  ])("accepts the captured signature for $name", async ({ input }) => {
    expect(await verifyMessageJoyId(input, f.signature, identity(f))).toBe(
      true,
    );
  });

  it.each([
    {
      name: "changed byte",
      input: Uint8Array.from([0, 1, 2, 0x7f, 0x80, 0xfe, 0]),
    },
    { name: "prefix", input: BINARY_MESSAGE.slice(0, -1) },
    { name: "empty", input: new Uint8Array() },
  ])(
    "rejects a $name challenge despite response overrides",
    async ({ input }) => {
      const signature = withFields(f.signature, {
        challenge: "0001027f80feff",
        isData: true,
      });
      expect(await verifyMessageJoyId(input, signature, identity(f))).toBe(
        false,
      );
    },
  );

  it.each(["0001027f80feff", "0x0001027f80feff"])(
    "treats %s as text rather than binary",
    async (message) => {
      expect(await verifyMessageJoyId(message, f.signature, identity(f))).toBe(
        false,
      );
    },
  );

  it("rejects a damaged captured signature", async () => {
    const data = JSON.parse(f.signature) as { signature: string };
    const damaged = Buffer.from(data.signature, "base64url");
    damaged[damaged.length - 1] ^= 1;
    expect(
      await verifyMessageJoyId(
        BINARY_MESSAGE,
        withFields(f.signature, {
          signature: damaged.toString("base64url"),
        }),
        identity(f),
      ),
    ).toBe(false);
  });

  it("accepts a high-S equivalent DER signature (derived, not a new capture)", async () => {
    const data = JSON.parse(f.signature) as { signature: string };
    const parsed = p256.Signature.fromBytes(
      Buffer.from(data.signature, "base64url"),
      "der",
    );
    const highS = new p256.Signature(
      parsed.r,
      parsed.hasHighS() ? parsed.s : p256.Point.Fn.ORDER - parsed.s,
    );
    expect(highS.hasHighS()).toBe(true);
    expect(
      await verifyMessageJoyId(
        BINARY_MESSAGE,
        withFields(f.signature, {
          signature: Buffer.from(highS.toBytes("der")).toString("base64url"),
        }),
        identity(f),
      ),
    ).toBe(true);
  });

  it("ignores response-owned identity and algorithm fields", async () => {
    const signature = withFields(f.signature, {
      keyType: "other",
      pubkey: "00".repeat(64),
      publicKey: "00".repeat(64),
      challenge: "Different challenge",
      alg: -257,
      isData: false,
    });
    expect(
      await verifyMessageJoyId(BINARY_MESSAGE, signature, identity(f)),
    ).toBe(true);
    expect(
      await verifyMessageJoyId(
        BINARY_MESSAGE,
        withFields(f.signature, {
          pubkey: f.publicKey,
        }),
        JSON.stringify({
          publicKey: fixture("r1_mainkey").publicKey,
          keyType: f.keyType,
        }),
      ),
    ).toBe(false);
  });

  it.each(
    ["other", "", null, undefined, 0, false, ["main_key"], {}].map(
      (keyType) => ({ keyType }),
    ),
  )("rejects unsupported binary key type $keyType", async ({ keyType }) => {
    expect(
      await verifyMessageJoyId(
        BINARY_MESSAGE,
        withFields(f.signature, {
          keyType: f.keyType,
        }),
        JSON.stringify({ publicKey: f.publicKey, keyType }),
      ),
    ).toBe(false);
  });

  it.each([0, 32, 50])(
    "rejects tampering with signed payload byte %i",
    async (offset) => {
      const data = JSON.parse(f.signature) as { message: string };
      const payload = Buffer.from(data.message, "base64url");
      payload[offset] ^= 1;
      expect(
        await verifyMessageJoyId(
          BINARY_MESSAGE,
          withFields(f.signature, {
            message: payload.toString("base64url"),
          }),
          identity(f),
        ),
      ).toBe(false);
    },
  );

  it("rejects a rewritten clientData challenge even when it matches the caller", async () => {
    const data = JSON.parse(f.signature) as { message: string };
    const payload = Buffer.from(data.message, "base64url");
    const changed = Uint8Array.from([9, 8, 7]);
    const clientData = JSON.parse(payload.subarray(37).toString()) as {
      challenge: string;
    };
    clientData.challenge = Buffer.from(changed).toString("base64url");
    const signature = withFields(f.signature, {
      message: Buffer.concat([
        payload.subarray(0, 37),
        Buffer.from(JSON.stringify(clientData)),
      ]).toString("base64url"),
    });
    expect(await verifyMessageJoyId(changed, signature, identity(f))).toBe(
      false,
    );
  });

  it.each([
    "AA",
    "!",
    Buffer.concat([Buffer.alloc(37), Buffer.from("not JSON")]).toString(
      "base64url",
    ),
  ])("rejects malformed binary payload %s", async (message) => {
    expect(
      await verifyMessageJoyId(
        BINARY_MESSAGE,
        withFields(f.signature, { message }),
        identity(f),
      ),
    ).toBe(false);
  });

  it("uses the captured binary signature through both Signer entry points", async () => {
    const signature = {
      signType: SignerSignType.JoyId,
      signature: f.signature,
      identity: identity(f),
    };
    const signer = new FixtureSigner(identity(f));
    const changedMessage = BINARY_MESSAGE.slice();
    changedMessage[changedMessage.length - 1] ^= 1;
    const wrongIdentity = JSON.stringify({
      keyType: f.keyType,
      publicKey: fixture("r1_mainkey").publicKey,
    });
    expect(await Signer.verifyMessage(BINARY_MESSAGE, signature)).toBe(true);
    expect(await Signer.verifyMessage(changedMessage, signature)).toBe(false);
    expect(
      await Signer.verifyMessage(BINARY_MESSAGE, {
        ...signature,
        identity: wrongIdentity,
      }),
    ).toBe(false);
    for (const response of [f.signature, signature]) {
      expect(await signer.verifyMessage(BINARY_MESSAGE, response)).toBe(true);
      expect(await signer.verifyMessage(changedMessage, response)).toBe(false);
      expect(
        await new FixtureSigner(wrongIdentity).verifyMessage(
          BINARY_MESSAGE,
          response,
        ),
      ).toBe(false);
    }
  });
});

describe("verifyMessageJoyId binary passkey compatibility", () => {
  it("verifies a synthetic hex-looking text challenge as text", async () => {
    const text = "0001027f80feff";
    const synthetic = syntheticBinaryPasskey(false, text);
    expect(
      await verifyMessageJoyId(text, synthetic.signature, identity(synthetic)),
    ).toBe(true);
    expect(
      await verifyMessageJoyId(
        BINARY_MESSAGE,
        synthetic.signature,
        identity(synthetic),
      ),
    ).toBe(false);
  });

  it.each(
    FIXTURES.filter(
      (item) => item.keyType === "main_key" || item.keyType === "sub_key",
    ),
  )(
    "verifies the unchanged text fixture $name against identical byte content",
    async (item) => {
      expect(
        await verifyMessageJoyId(
          bytesFrom(MESSAGE, "utf8"),
          item.signature,
          identity(item),
        ),
      ).toBe(true);
    },
  );

  it.each([false, true])(
    "verifies synthetic binary passkeys (RSA=%s)",
    async (rsa) => {
      const synthetic = syntheticBinaryPasskey(rsa);
      const data = JSON.parse(synthetic.signature) as {
        signature: string;
        message: string;
      };
      const damagedSignature = Buffer.from(data.signature, "base64url");
      damagedSignature[damagedSignature.length - 1] ^= 1;
      const damagedPayload = Buffer.from(data.message, "base64url");
      damagedPayload[0] ^= 1;
      for (const keyType of ["main_key", "sub_key"]) {
        const trusted = identity({ ...synthetic, keyType });
        expect(
          await verifyMessageJoyId(
            BINARY_MESSAGE,
            withFields(synthetic.signature, { alg: rsa ? -7 : -257 }),
            trusted,
          ),
        ).toBe(true);
        expect(
          await verifyMessageJoyId(
            BINARY_MESSAGE,
            withFields(synthetic.signature, {
              signature: damagedSignature.toString("base64url"),
            }),
            trusted,
          ),
        ).toBe(false);
        expect(
          await verifyMessageJoyId(
            BINARY_MESSAGE,
            withFields(synthetic.signature, {
              message: damagedPayload.toString("base64url"),
            }),
            trusted,
          ),
        ).toBe(false);
        expect(
          await verifyMessageJoyId(
            BINARY_MESSAGE.slice(1),
            synthetic.signature,
            trusted,
          ),
        ).toBe(false);
        expect(
          await verifyMessageJoyId(
            "0001027f80feff",
            synthetic.signature,
            trusted,
          ),
        ).toBe(false);
      }
    },
  );
});

describe("JoyID credential binding", () => {
  it.each(["ckb1fixture", "ckt1fixture"])(
    "checks the trusted address and derived algorithm for %s",
    async (address) => {
      const f = fixture("r1_mainkey");
      const trusted = JSON.stringify({ ...JSON.parse(identity(f)), address });
      expect(
        await verifyMessageJoyId(
          MESSAGE,
          withFields(f.signature, {
            address: "ckb1untrusted",
            alg: -257,
          }),
          trusted,
        ),
      ).toBe(true);
      expect(verifyCredential).toHaveBeenCalledExactlyOnceWith(
        {
          address,
          pubkey: f.publicKey,
          keyType: f.keyType,
          alg: SigningAlg.ES256,
        },
        address.startsWith("ckb")
          ? "https://api.joy.id/api/v1/"
          : "https://api.testnet.joyid.dev/api/v1/",
      );
    },
  );

  it.each([
    ...FIXTURES.map((f) => ({ ...f, input: MESSAGE })),
    ...BINARY_FIXTURES.map((f) => ({ ...f, input: BINARY_MESSAGE })),
  ])("requires credential approval for $name", async (f) => {
    vi.mocked(verifyCredential).mockResolvedValue(false);
    expect(await verifyMessageJoyId(f.input, f.signature, identity(f))).toBe(
      false,
    );
    expect(verifyCredential).toHaveBeenCalledExactlyOnceWith(
      {
        address: "ckt1fixture",
        pubkey: f.publicKey,
        keyType: f.keyType,
        alg: f.publicKey.length === 128 ? SigningAlg.ES256 : SigningAlg.RS256,
      },
      "https://api.testnet.joyid.dev/api/v1/",
    );
  });

  it("does not query the registry for an invalid signature", async () => {
    const f = fixture("r1_mainkey");
    expect(
      await verifyMessageJoyId("Wrong message", f.signature, identity(f)),
    ).toBe(false);
    expect(verifyCredential).not.toHaveBeenCalled();
  });
});
