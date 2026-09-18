import { ccc } from "@ckb-ccc/core";
import { describe, expect, it, vi } from "vitest";
import { Provider, toUniSatSignPsbtOptions } from "./advancedBarrel.js";
import { Signer } from "./signer.js";

const CLIENT = ccc.ClientPublicTestnet.new({
  transport: {
    request: async () => {
      throw new Error("Unexpected request");
    },
  },
});

function createProvider() {
  const signPsbt = vi.fn(async (): Promise<string> => "70736274ff");
  const provider = { signPsbt } as unknown as Provider;
  return { provider, signPsbt };
}

describe("toUniSatSignPsbtOptions", () => {
  it("should default autoFinalized to true and omit toSignInputs", () => {
    expect(toUniSatSignPsbtOptions()).toEqual({ autoFinalized: true });
    expect(toUniSatSignPsbtOptions({})).toEqual({ autoFinalized: true });
    expect(toUniSatSignPsbtOptions({ inputsToSign: [] })).toEqual({
      autoFinalized: true,
    });
  });

  it("should keep an explicit autoFinalized false", () => {
    expect(toUniSatSignPsbtOptions({ autoFinalized: false })).toEqual({
      autoFinalized: false,
    });
  });

  it("should translate inputsToSign into toSignInputs", () => {
    expect(
      toUniSatSignPsbtOptions({
        inputsToSign: [
          { index: 0, address: "bc1q", sighashTypes: [1] },
          { index: 2, publicKey: "0xabcd", disableTweakSigner: true },
        ],
      }),
    ).toEqual({
      autoFinalized: true,
      toSignInputs: [
        { index: 0, address: "bc1q", sighashTypes: [1] },
        { index: 2, publicKey: "abcd", disableTweakSigner: true },
      ],
    });
  });

  it("should reject an input without address or publicKey", () => {
    expect(() =>
      toUniSatSignPsbtOptions(
        new ccc.SignPsbtOptions(true, [new ccc.InputToSign(3)]),
      ),
    ).toThrow("Either address or publicKey is required for input #3");
  });

  it("should strip the 0x prefix from publicKey", () => {
    const { toSignInputs } = toUniSatSignPsbtOptions({
      inputsToSign: [{ index: 0, publicKey: new Uint8Array([0xab, 0xcd]) }],
    });
    expect(toSignInputs?.[0].publicKey).toBe("abcd");
  });

  it("should not strip characters from an unprefixed publicKey", () => {
    const { toSignInputs } = toUniSatSignPsbtOptions(
      new ccc.SignPsbtOptions(true, [
        new ccc.InputToSign(
          0,
          undefined,
          undefined,
          undefined,
          "abcd" as ccc.Hex,
        ),
      ]),
    );
    expect(toSignInputs?.[0].publicKey).toBe("abcd");
  });
});

describe("Signer.signPsbt", () => {
  it("should send the default options to the wallet", async () => {
    const { provider, signPsbt } = createProvider();
    const signer = new Signer(CLIENT, provider);

    const signed = await signer.signPsbt("0x70736274ff");

    expect(signed).toBe("0x70736274ff");
    expect(signPsbt).toHaveBeenCalledWith("70736274ff", {
      autoFinalized: true,
    });
  });

  it("should translate the options to the wallet's shape", async () => {
    const { provider, signPsbt } = createProvider();
    const signer = new Signer(CLIENT, provider);

    await signer.signPsbt("0x70736274ff", {
      autoFinalized: false,
      inputsToSign: [{ index: 1, address: "bc1q" }],
    });

    expect(signPsbt).toHaveBeenCalledWith("70736274ff", {
      autoFinalized: false,
      toSignInputs: [{ index: 1, address: "bc1q" }],
    });
  });
});
