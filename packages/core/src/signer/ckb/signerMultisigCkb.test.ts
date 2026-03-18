import { describe, expect, it } from "vitest";
import { ccc } from "../../index.js";

const client = new ccc.ClientPublicTestnet();
const ZERO_HASH =
  "0x0000000000000000000000000000000000000000000000000000000000000000";

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

  describe("signature matching logic", () => {
    const privKey1 =
      "0x0000000000000000000000000000000000000000000000000000000000000001";
    const privKey2 =
      "0x0000000000000000000000000000000000000000000000000000000000000002";
    const privKey3 =
      "0x0000000000000000000000000000000000000000000000000000000000000003";
    const signer1 = new ccc.SignerCkbPrivateKey(client, privKey1);
    const signer2 = new ccc.SignerCkbPrivateKey(client, privKey2);
    const signer3 = new ccc.SignerCkbPrivateKey(client, privKey3);

    const message = ccc.hashCkb("0x0123456789abcdef");

    it("should count signatures when required signers signed", async () => {
      const sig1 = await signer1._signMessage(message);
      const sig2 = await signer2._signMessage(message);

      const witness = ccc.MultisigCkbWitness.from({
        publicKeys: [signer1.publicKey, signer2.publicKey, signer3.publicKey],
        threshold: 2,
        mustMatch: 1, // signer1 is required
        signatures: [sig1, sig2],
      });

      const counts = witness.calcMatchedSignaturesCount(message);
      expect(counts.required).toBe(1);
      expect(counts.flexible).toBe(1);
    });

    it("should count signatures when only flexible signers signed", async () => {
      const sig2 = await signer2._signMessage(message);
      const sig3 = await signer3._signMessage(message);

      const witness = ccc.MultisigCkbWitness.from({
        publicKeys: [signer1.publicKey, signer2.publicKey, signer3.publicKey],
        threshold: 2,
        mustMatch: 1,
        signatures: [sig2, sig3],
      });

      const counts = witness.calcMatchedSignaturesCount(message);
      expect(counts.required).toBe(0);
      expect(counts.flexible).toBe(2);
    });
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
    expect(await signer.getMemberRequiredCount()).toBe(0);
  });

  describe("getSignaturesCount with mustMatch", () => {
    const privKey1 =
      "0x0000000000000000000000000000000000000000000000000000000000000001";
    const privKey2 =
      "0x0000000000000000000000000000000000000000000000000000000000000002";
    const privKey3 =
      "0x0000000000000000000000000000000000000000000000000000000000000003";
    const signer1 = new ccc.SignerCkbPrivateKey(client, privKey1);
    const signer2 = new ccc.SignerCkbPrivateKey(client, privKey2);
    const signer3 = new ccc.SignerCkbPrivateKey(client, privKey3);

    const multisigSigner = new ccc.SignerMultisigCkbReadonly(client, {
      publicKeys: [signer1.publicKey, signer2.publicKey, signer3.publicKey],
      threshold: 2,
      mustMatch: 1, // signer1 is required
    });

    const message = ccc.hashCkb("0x0123456789abcdef");
    multisigSigner.getSignInfo = async () => ({
      message: message,
      position: 0,
    });

    const getTx = (signatures: string[]) =>
      ccc.Transaction.from({
        inputs: [{ previousOutput: { txHash: ZERO_HASH, index: 0 }, since: 0 }],
        witnesses: [
          ccc.WitnessArgs.from({
            lock: ccc.MultisigCkbWitness.from({
              publicKeyHashes: multisigSigner.multisigInfo.publicKeyHashes,
              threshold: 2,
              mustMatch: 1,
              signatures,
            }).toBytes(),
          }).toBytes(),
        ],
      });

    it("should return 1 when only required signer signed", async () => {
      const sig1 = await signer1._signMessage(message);
      const tx = getTx([sig1]);
      expect(await multisigSigner.getSignaturesCount(tx)).toBe(1);
      expect(await multisigSigner.needMoreSignatures(tx)).toBe(true);
    });

    it("should return 1 when only flexible signers signed", async () => {
      const sig2 = await signer2._signMessage(message);
      const sig3 = await signer3._signMessage(message);
      const tx = getTx([sig2, sig3]);
      expect(await multisigSigner.getSignaturesCount(tx)).toBe(1);
      expect(await multisigSigner.needMoreSignatures(tx)).toBe(true);
    });

    it("should return 2 when required and flexible signers signed", async () => {
      const sig1 = await signer1._signMessage(message);
      const sig2 = await signer2._signMessage(message);
      const tx = getTx([sig1, sig2]);
      expect(await multisigSigner.getSignaturesCount(tx)).toBe(2);
      expect(await multisigSigner.needMoreSignatures(tx)).toBe(false);
    });
  });

  describe("aggregateTransactions with mustMatch", () => {
    const privKey1 =
      "0x0000000000000000000000000000000000000000000000000000000000000001";
    const privKey2 =
      "0x0000000000000000000000000000000000000000000000000000000000000002";
    const privKey3 =
      "0x0000000000000000000000000000000000000000000000000000000000000003";
    const signer1 = new ccc.SignerCkbPrivateKey(client, privKey1);
    const signer2 = new ccc.SignerCkbPrivateKey(client, privKey2);
    const signer3 = new ccc.SignerCkbPrivateKey(client, privKey3);

    const multisigSigner = new ccc.SignerMultisigCkbReadonly(client, {
      publicKeys: [signer1.publicKey, signer2.publicKey, signer3.publicKey],
      threshold: 2,
      mustMatch: 1, // signer1 is required
    });

    const message = ccc.hashCkb("0x0123456789abcdef");
    multisigSigner.getSignInfo = async () => ({
      message: message,
      position: 0,
    });

    it("should aggregate required signatures from different transactions", async () => {
      const sig1 = await signer1._signMessage(message);
      const sig2 = await signer2._signMessage(message);
      const sig3 = await signer3._signMessage(message);

      const tx1 = ccc.Transaction.from({
        inputs: [{ previousOutput: { txHash: ZERO_HASH, index: 0 }, since: 0 }],
        witnesses: [
          ccc.WitnessArgs.from({
            lock: ccc.MultisigCkbWitness.from({
              publicKeyHashes: multisigSigner.multisigInfo.publicKeyHashes,
              threshold: 2,
              mustMatch: 1,
              signatures: [sig2, sig3], // Missing required
            }).toBytes(),
          }).toBytes(),
        ],
      });

      const tx2 = ccc.Transaction.from({
        inputs: [{ previousOutput: { txHash: ZERO_HASH, index: 0 }, since: 0 }],
        witnesses: [
          ccc.WitnessArgs.from({
            lock: ccc.MultisigCkbWitness.from({
              publicKeyHashes: multisigSigner.multisigInfo.publicKeyHashes,
              threshold: 2,
              mustMatch: 1,
              signatures: [sig1], // Contains required
            }).toBytes(),
          }).toBytes(),
        ],
      });

      const aggregatedTx = await multisigSigner.aggregateTransactions([
        tx1,
        tx2,
      ]);
      const decodedWitness = multisigSigner.decodeWitnessArgsAt(
        aggregatedTx,
        0,
      )!;

      const { required, flexible } =
        decodedWitness.calcMatchedSignaturesCount(message);
      expect(required).toBe(1);
      expect(flexible).toBe(1);
      expect(decodedWitness.signatures.length).toBe(2);
    });
  });
});

describe("SignerMultisigCkbPrivateKey", () => {
  const privKey1 =
    "0x0000000000000000000000000000000000000000000000000000000000000001";
  const privKey2 =
    "0x0000000000000000000000000000000000000000000000000000000000000002";
  const privKey3 =
    "0x0000000000000000000000000000000000000000000000000000000000000003";
  const signer1 = new ccc.SignerCkbPrivateKey(client, privKey1);
  const signer2 = new ccc.SignerCkbPrivateKey(client, privKey2);
  const signer3 = new ccc.SignerCkbPrivateKey(client, privKey3);

  const multisigWitness: ccc.MultisigCkbWitnessLike = {
    publicKeys: [signer1.publicKey, signer2.publicKey, signer3.publicKey],
    threshold: 2,
    mustMatch: 1, // signer1 is required
  };

  const message = ccc.hashCkb("0x0123456789abcdef");

  it("should replace a flexible signature with a required one if threshold reached", async () => {
    const sig2 = await signer2._signMessage(message);
    const sig3 = await signer3._signMessage(message);

    const multisigSigner1 = new ccc.SignerMultisigCkbPrivateKey(
      client,
      privKey1,
      multisigWitness,
    );
    multisigSigner1.getSignInfo = async () => ({
      message: message,
      position: 0,
    });

    const tx = ccc.Transaction.from({
      inputs: [{ previousOutput: { txHash: ZERO_HASH, index: 0 }, since: 0 }],
      witnesses: [
        ccc.WitnessArgs.from({
          lock: ccc.MultisigCkbWitness.from({
            publicKeyHashes: multisigSigner1.multisigInfo.publicKeyHashes,
            threshold: 2,
            mustMatch: 1,
            signatures: [sig2, sig3],
          }).toBytes(),
        }).toBytes(),
      ],
    });

    const signedTx = await multisigSigner1.signOnlyTransaction(tx);
    const decodedWitness = multisigSigner1.decodeWitnessArgsAt(signedTx, 0)!;

    const { required, flexible } =
      decodedWitness.calcMatchedSignaturesCount(message);
    expect(required).toBe(1);
    expect(flexible).toBe(1);
    expect(decodedWitness.signatures.length).toBe(2);
  });
});
