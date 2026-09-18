import { ccc } from "@ckb-ccc/core";
import { describe, expect, it, vi } from "vitest";
import { BitcoinProvider } from "../advancedBarrel.js";
import { BitcoinSigner } from "./index.js";

const CLIENT = ccc.ClientPublicTestnet.new({
  transport: {
    request: async () => {
      throw new Error("Unexpected request");
    },
  },
});

function createSigner() {
  const signPsbt = vi.fn(async (): Promise<string> => "70736274ff");
  const provider = { signPsbt } as unknown as BitcoinProvider;
  const signer = new BitcoinSigner(CLIENT, { bitcoin: provider });
  return { signer, signPsbt };
}

describe("BitcoinSigner.signPsbt", () => {
  it("should send the default options to the wallet", async () => {
    const { signer, signPsbt } = createSigner();

    const signed = await signer.signPsbt("0x70736274ff");

    expect(signed).toBe("0x70736274ff");
    expect(signPsbt).toHaveBeenCalledWith("70736274ff", {
      autoFinalized: true,
    });
  });

  it("should translate the options to the wallet's shape", async () => {
    const { signer, signPsbt } = createSigner();

    await signer.signPsbt("0x70736274ff", {
      autoFinalized: false,
      inputsToSign: [{ index: 1, publicKey: "0xabcd" }],
    });

    expect(signPsbt).toHaveBeenCalledWith("70736274ff", {
      autoFinalized: false,
      toSignInputs: [{ index: 1, publicKey: "abcd" }],
    });
  });
});
