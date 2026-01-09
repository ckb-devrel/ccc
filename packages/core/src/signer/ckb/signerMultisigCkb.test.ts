import { describe, expect, it } from "vitest";
import { ccc } from "../../index.js";

const client = new ccc.ClientPublicTestnet();

describe("MultisigCkbWitness", () => {
  it("should encode and decode correctly", () => {
    const witness: ccc.MultisigCkbWitnessLike = {
      publicKeys: [
        "0x024a501efd328e062c8675f2365970728c859c592beeefd6be8ece3d8d3c80fa80",
        "0x024a501efd328e062c8675f2365970728c859c592beeefd6be8ece3d8d3c80fa81",
      ],
      threshold: 1,
      mustMatch: 0,
      signatures: [],
    };

    const encoded = ccc.MultisigCkbWitness.from(witness).toBytes();
    const decoded = ccc.MultisigCkbWitness.decode(encoded);

    expect(decoded.threshold).toBe(witness.threshold);
    expect(decoded.mustMatch).toBe(witness.mustMatch);
    expect(decoded.publicKeyHashes.length).toBe(witness.publicKeys.length);
  });

  it("should throw error for invalid threshold", () => {
    expect(() => {
      new ccc.MultisigCkbWitness([], 0, 0, []);
    }).toThrow("threshold should be in range from 1 to public keys length");

    expect(() => {
      new ccc.MultisigCkbWitness([], 1, 0, []);
    }).toThrow("threshold should be in range from 1 to public keys length");
  });

  it("should throw error for invalid mustMatch", () => {
    expect(() => {
      new ccc.MultisigCkbWitness(["0x00"], 1, 2, []);
    }).toThrow(
      "mustMatch should be in range from 0 to min(public keys length, threshold)",
    );
  });

  it("should calculate scriptArgs correctly", () => {
    const witness: ccc.MultisigCkbWitnessLike = {
      publicKeys: [
        "0x024a501efd328e062c8675f2365970728c859c592beeefd6be8ece3d8d3c80fa80",
        "0x024a501efd328e062c8675f2365970728c859c592beeefd6be8ece3d8d3c80fa81",
      ],
      threshold: 1,
      mustMatch: 0,
    };
    const multisigWitness = ccc.MultisigCkbWitness.from(witness);
    const args = multisigWitness.scriptArgs();
    expect(args).toBeInstanceOf(Uint8Array);
    expect(ccc.hexFrom(args)).toBe(
      "0x6418f118e94d8dff7d9b0b59a4d837c4e201c5a9",
    );
  });
});

describe("SignerMultisigCkbReadonly", () => {
  it("should initialize correctly", async () => {
    const witness: ccc.MultisigCkbWitnessLike = {
      publicKeys: [
        "0x024a501efd328e062c8675f2365970728c859c592beeefd6be8ece3d8d3c80fa80",
        "0x024a501efd328e062c8675f2365970728c859c592beeefd6be8ece3d8d3c80fa81",
      ],
      threshold: 1,
      mustMatch: 0,
    };

    const signer = new ccc.SignerMultisigCkbReadonly(client, witness);

    expect(await signer.getMemberCount()).toBe(2);
    expect(await signer.getMemberThreshold()).toBe(1);
  });
});
