import { secp256k1 } from "@noble/curves/secp256k1.js";
import { describe, expect, it } from "vitest";
import {
  getGenesisOperation,
  getRotationKeys,
  parseDidKey,
  signRotationHash,
  verifyPrivateKeyMatch,
  type PlcOperation,
} from "./index.js";

describe("parseDidKey", () => {
  it("recognises secp256k1 multicodec tag (0xe7 0x01)", () => {
    // Real did:key from the bluesky network — secp256k1 public key.
    const didKey = "did:key:zQ3shqtXEdagupBhLzL2vFUACfdVjDEvciip79uY8iHBuu7FD";
    const { curve, compressedPubkey } = parseDidKey(didKey);
    expect(curve).toBe("secp256k1");
    expect(compressedPubkey.length).toBe(33);
  });

  it("recognises p256 multicodec tag (0x80 0x24)", () => {
    const didKey = "did:key:zDnaefn5fMKvoZ1n4vyxJ9npjWE5P3D8GkM9zNqaGbLqdDrtX";
    const { curve, compressedPubkey } = parseDidKey(didKey);
    expect(curve).toBe("p256");
    expect(compressedPubkey.length).toBe(33);
  });

  it("rejects unknown prefixes", () => {
    expect(() => parseDidKey("did:key:abc")).toThrow();
    expect(() => parseDidKey("did:plc:abc")).toThrow();
  });
});

describe("getRotationKeys", () => {
  it("returns rotationKeys from modern plc_operation", () => {
    const op: PlcOperation = {
      type: "plc_operation",
      rotationKeys: [
        "did:key:zQ3shqtXEdagupBhLzL2vFUACfdVjDEvciip79uY8iHBuu7FD",
        "did:key:zDnaefn5fMKvoZ1n4vyxJ9npjWE5P3D8GkM9zNqaGbLqdDrtX",
      ],
      prev: null,
      sig: "x",
    };
    const keys = getRotationKeys(op);
    expect(keys.map((k) => k.curve)).toEqual(["secp256k1", "p256"]);
  });

  it("falls back to signingKey + recoveryKey from legacy create op", () => {
    const op: PlcOperation = {
      type: "create",
      signingKey: "did:key:zQ3shqtXEdagupBhLzL2vFUACfdVjDEvciip79uY8iHBuu7FD",
      recoveryKey: "did:key:zQ3shqtXEdagupBhLzL2vFUACfdVjDEvciip79uY8iHBuu7FD",
      prev: null,
      sig: "x",
    };
    const keys = getRotationKeys(op);
    expect(keys.length).toBe(2);
  });
});

describe("getGenesisOperation", () => {
  it("returns the first op", () => {
    const op: PlcOperation = { type: "x", prev: null, sig: "y" };
    expect(getGenesisOperation([op])).toBe(op);
  });
  it("throws on empty log", () => {
    expect(() => getGenesisOperation([])).toThrow();
  });
});

describe("signRotationHash + verifyPrivateKeyMatch", () => {
  it("round-trips: signature verifies, private key matches its public", () => {
    const priv = secp256k1.utils.randomSecretKey();
    const pub = secp256k1.getPublicKey(priv, true);
    expect(verifyPrivateKeyMatch(priv, pub, "secp256k1")).toBe(true);

    const txHash = new Uint8Array(32).fill(7);
    const sig = signRotationHash(priv, txHash, "secp256k1");
    expect(sig.length).toBe(64);
    expect(
      secp256k1.verify(sig, txHash, pub, { prehash: true, lowS: true }),
    ).toBe(true);
  });

  it("rejects a private key whose pubkey doesn't match", () => {
    const a = secp256k1.utils.randomSecretKey();
    const b = secp256k1.utils.randomSecretKey();
    expect(
      verifyPrivateKeyMatch(a, secp256k1.getPublicKey(b, true), "secp256k1"),
    ).toBe(false);
  });

  it("throws on wrong tx hash length", () => {
    const priv = secp256k1.utils.randomSecretKey();
    expect(() =>
      signRotationHash(priv, new Uint8Array(31), "secp256k1"),
    ).toThrow();
  });
});
