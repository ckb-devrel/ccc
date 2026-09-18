import { describe, expect, it } from "vitest";
import { InputToSign, SignPsbtOptions } from "./psbt";

describe("SignPsbtOptions.from", () => {
  it("should default autoFinalized to true and inputsToSign to empty", () => {
    const options = SignPsbtOptions.from();
    expect(options.autoFinalized).toBe(true);
    expect(options.inputsToSign).toEqual([]);
  });

  it("should default autoFinalized to true when only inputsToSign is set", () => {
    const options = SignPsbtOptions.from({
      inputsToSign: [{ index: 0, address: "bc1q" }],
    });
    expect(options.autoFinalized).toBe(true);
  });

  it("should keep an explicit autoFinalized false", () => {
    const options = SignPsbtOptions.from({ autoFinalized: false });
    expect(options.autoFinalized).toBe(false);
  });

  it("should normalize inputsToSign into InputToSign instances", () => {
    const options = SignPsbtOptions.from({
      inputsToSign: [
        { index: 1, address: "bc1q", sighashTypes: [1] },
        { index: 2, publicKey: "0xab", disableTweakSigner: true },
      ],
    });

    expect(options.inputsToSign).toHaveLength(2);
    options.inputsToSign.forEach((input) =>
      expect(input).toBeInstanceOf(InputToSign),
    );
    expect(options.inputsToSign[0]).toMatchObject({
      index: 1,
      address: "bc1q",
      sighashTypes: [1],
    });
    expect(options.inputsToSign[1]).toMatchObject({
      index: 2,
      publicKey: "0xab",
      disableTweakSigner: true,
    });
  });

  it("should return the same instance when given SignPsbtOptions", () => {
    const options = new SignPsbtOptions(false, []);
    expect(SignPsbtOptions.from(options)).toBe(options);
  });
});
