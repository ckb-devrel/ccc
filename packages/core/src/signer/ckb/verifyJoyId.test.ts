import { describe, expect, it } from "vitest";
import { verifyMessageJoyId } from "./verifyJoyId.js";

// Signatures of "Sign this for me" from joyid-sdk-js packages/ckb/fixtures,
// with signature and message in base64url as the JoyID popup returns them.
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

function identity(fixture: (typeof FIXTURES)[number]): string {
  return JSON.stringify({
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

  it("rejects a key of another type for another message", async () => {
    const f = fixture("rsa_main_session_key");
    const other = JSON.stringify({ keyType: "other", publicKey: f.publicKey });

    expect(await verifyMessageJoyId(MESSAGE, f.signature, other)).toBe(true);
    expect(
      await verifyMessageJoyId("Another message", f.signature, other),
    ).toBe(false);
  });

  it("ignores a challenge in the signature", async () => {
    const f = fixture("r1_mainkey");
    const signature = withFields(f.signature, { challenge: MESSAGE });

    expect(
      await verifyMessageJoyId("Another message", signature, identity(f)),
    ).toBe(false);
  });

  it("reads the algorithm from the public key", async () => {
    const f = fixture("r1_mainkey");
    const signature = withFields(f.signature, { alg: -257 });

    expect(await verifyMessageJoyId(MESSAGE, signature, identity(f))).toBe(
      true,
    );
  });
});
