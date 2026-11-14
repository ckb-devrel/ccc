import { ccc } from "@ckb-ccc/core";
import { schnorr, secp256k1 } from "@noble/curves/secp256k1.js";
import * as btc from "@scure/btc-signer";
import { RawPSBTV0 } from "@scure/btc-signer/psbt.js";
import { describe, expect, it, vi } from "vitest";
import {
  AddressPurpose,
  AddressType,
  BtcProvider,
  SignPsbtParams,
} from "./advancedBarrel.js";
import { Signer } from "./signer.js";

const CLIENT = ccc.ClientPublicTestnet.new({
  transport: {
    request: async () => {
      throw new Error("Unexpected request");
    },
  },
});

function createKey(seed: number) {
  const privateKey = new Uint8Array(32).fill(seed);
  const publicKey = secp256k1.getPublicKey(privateKey, true);
  const { address, script } = btc.p2wpkh(publicKey, btc.TEST_NETWORK);
  return { privateKey, publicKey, address, script };
}

const WALLET = createKey(1);
const OTHER = createKey(2);

function createPsbt(...inputs: { script: Uint8Array }[]): ccc.Hex {
  const tx = new btc.Transaction({ unknown: "ignore" });
  inputs.forEach(({ script }, i) => {
    tx.addInput({
      txid: new Uint8Array(32).fill(i + 1),
      index: 0,
      witnessUtxo: { script, amount: 10000n },
    });
  });
  tx.addOutputAddress(WALLET.address, 9000n, btc.TEST_NETWORK);
  return ccc.hexFrom(tx.toPSBT());
}

function createSigner({ sign = true } = {}) {
  const signPsbt = vi.fn((params: SignPsbtParams) => {
    const tx = btc.Transaction.fromPSBT(ccc.bytesFrom(params.psbt, "base64"), {
      unknown: "ignore",
    });
    if (sign) {
      Object.entries(params.signInputs).forEach(([address, indexes]) => {
        expect(address).toBe(WALLET.address);
        indexes.forEach((index) => tx.signIdx(WALLET.privateKey, index));
      });
    }
    return { psbt: ccc.bytesTo(tx.toPSBT(), "base64") };
  });

  const provider = {
    request: vi.fn(async (method: string, params: unknown) => {
      const result = (() => {
        switch (method) {
          case "getAddresses":
            return {
              addresses: [
                {
                  address: WALLET.address,
                  publicKey: ccc.hexFrom(WALLET.publicKey).slice(2),
                  purpose: AddressPurpose.Payment,
                  addressType: AddressType.p2wpkh,
                },
              ],
            };
          case "signPsbt":
            return signPsbt(params as SignPsbtParams);
          default:
            throw new Error(`Unexpected request ${method}`);
        }
      })();
      return { jsonrpc: "2.0", id: "1", result };
    }),
    addListener: vi.fn(() => () => {}),
  } as unknown as BtcProvider;

  return { signer: new Signer(CLIENT, provider), signPsbt };
}

function inputsOf(signed: ccc.Hex) {
  const tx = btc.Transaction.fromPSBT(ccc.bytesFrom(signed), {
    unknown: "ignore",
  });
  return Array.from({ length: tx.inputsLength }, (_, i) => tx.getInput(i));
}

describe("Signer.signPsbt", () => {
  it.each([false, true])(
    "should handle wrapped SegWit (autoFinalized: %s)",
    async (autoFinalized) => {
      const wrapped = btc.p2sh(btc.p2wpkh(WALLET.publicKey));
      const tx = new btc.Transaction();
      tx.addInput({
        txid: new Uint8Array(32).fill(1),
        index: 0,
        witnessUtxo: { amount: 10000n, script: wrapped.script },
        redeemScript: wrapped.redeemScript,
      });
      tx.addOutput({ amount: 9000n, script: WALLET.script });
      const request = ccc.hexFrom(tx.toPSBT());
      tx.signIdx(WALLET.privateKey, 0);
      const { signer, signPsbt } = createSigner();
      signPsbt.mockReturnValue({ psbt: ccc.bytesTo(tx.toPSBT(), "base64") });
      const [input] = inputsOf(
        await signer.signPsbt(request, {
          autoFinalized,
          inputsToSign: [{ index: 0, address: WALLET.address }],
        }),
      );
      expect(!!input.finalScriptWitness).toBe(autoFinalized);
      expect(!!input.finalScriptSig).toBe(autoFinalized);
      expect(!!input.partialSig).toBe(!autoFinalized);
      expect(input.redeemScript).toEqual(
        autoFinalized ? undefined : wrapped.redeemScript,
      );
    },
  );

  it.each([false, true])(
    "should reject invalid redeemScript (autoFinalized: %s)",
    async (autoFinalized) => {
      const tx = new btc.Transaction();
      tx.addInput({
        txid: new Uint8Array(32).fill(1),
        index: 0,
        witnessUtxo: { amount: 10000n, script: WALLET.script },
      });
      tx.addOutput({ amount: 9000n, script: WALLET.script });
      const request = ccc.hexFrom(tx.toPSBT());
      const raw = RawPSBTV0.decode(tx.toPSBT());
      raw.inputs[0].redeemScript = WALLET.script;
      const invalid = RawPSBTV0.encode(raw);
      const { signer, signPsbt } = createSigner();
      signPsbt.mockReturnValue({ psbt: ccc.bytesTo(invalid, "base64") });
      try {
        await signer.signPsbt(request, {
          autoFinalized,
          inputsToSign: [{ index: 0, address: WALLET.address }],
        });
        expect.fail("Invalid script metadata must be rejected");
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toContain("redeemScript");
      }
    },
  );

  describe.each([0, 2] as const)(
    "PSBT v%s Taproot key path with tree metadata",
    (version) => {
      it.each([0, 3, 0x83])(
        "should preserve/finalize input 1 with sighash %s",
        async (mode) => {
          const tree = btc.p2tr(schnorr.getPublicKey(WALLET.privateKey), {
            script: btc.p2tr_pk(schnorr.getPublicKey(OTHER.privateKey)).script,
          });
          const tx = new btc.Transaction({ PSBTVersion: version });
          for (let index = 0; index < 2; index++) {
            tx.addInput({
              txid: new Uint8Array(32).fill(index + 1),
              index: 0,
              witnessUtxo: { amount: 10000n, script: tree.script },
              tapInternalKey: tree.tapInternalKey,
              tapMerkleRoot: tree.tapMerkleRoot,
              tapLeafScript: tree.tapLeafScript,
            });
            tx.addOutput({ amount: 9000n, script: WALLET.script });
          }
          tx.updateInput(1, { sighashType: mode });
          const request = ccc.hexFrom(tx.toPSBT());
          tx.signIdx(WALLET.privateKey, 1, [mode]);
          const { signer, signPsbt } = createSigner();
          signPsbt.mockReturnValue({
            psbt: ccc.bytesTo(tx.toPSBT(), "base64"),
          });
          for (const autoFinalized of [false, true]) {
            const [pending, signed] = inputsOf(
              await signer.signPsbt(request, {
                autoFinalized,
                inputsToSign: [
                  { index: 1, address: WALLET.address, sighashTypes: [mode] },
                ],
              }),
            );
            expect(pending.finalScriptWitness).toBeUndefined();
            if (autoFinalized) {
              expect(signed.finalScriptWitness).toHaveLength(1);
              expect(signed.tapKeySig).toBeUndefined();
            } else {
              expect(signed.finalScriptWitness).toBeUndefined();
              expect(signed.tapKeySig).toEqual(tx.getInput(1).tapKeySig);
            }
          }
        },
      );
    },
  );
  it("should finalize the signed inputs by default", async () => {
    const { signer, signPsbt } = createSigner();

    const signed = await signer.signPsbt(createPsbt(WALLET));

    expect(signPsbt).toHaveBeenCalledWith(
      expect.objectContaining({
        signInputs: { [WALLET.address]: [0] },
        broadcast: false,
      }),
    );
    const [input] = inputsOf(signed);
    expect(input.finalScriptWitness).toBeDefined();
    expect(input.partialSig).toBeUndefined();
  });

  it("should return the partially signed PSBT when autoFinalized is false", async () => {
    const { signer } = createSigner();

    const signed = await signer.signPsbt(createPsbt(WALLET), {
      autoFinalized: false,
    });

    const [input] = inputsOf(signed);
    expect(input.finalScriptWitness).toBeUndefined();
    expect(input.partialSig).toHaveLength(1);
  });

  it("should only finalize the requested inputs", async () => {
    const { signer, signPsbt } = createSigner();

    const signed = await signer.signPsbt(createPsbt(WALLET, OTHER), {
      inputsToSign: [{ index: 0, address: WALLET.address }],
    });

    expect(signPsbt).toHaveBeenCalledWith(
      expect.objectContaining({ signInputs: { [WALLET.address]: [0] } }),
    );
    const [mine, theirs] = inputsOf(signed);
    expect(mine.finalScriptWitness).toBeDefined();
    expect(theirs.finalScriptWitness).toBeUndefined();
    expect(theirs.partialSig).toBeUndefined();
  });

  it("should preserve inputs that are not ready to finalize", async () => {
    const { signer } = createSigner({ sign: false });
    const request = createPsbt(WALLET);
    expect(await signer.signPsbt(request)).toBe(request);
  });

  it("should finalize previously signed inputs outside the signing selection", async () => {
    const { signer } = createSigner();
    const tx = btc.Transaction.fromPSBT(
      ccc.bytesFrom(createPsbt(WALLET, OTHER)),
    );
    tx.signIdx(OTHER.privateKey, 1);
    const signed = await signer.signPsbt(ccc.hexFrom(tx.toPSBT()), {
      inputsToSign: [{ index: 0, address: WALLET.address }],
    });
    expect(
      inputsOf(signed).every((input) => input.finalScriptWitness?.length),
    ).toBe(true);
  });

  it("should report missing UTXO data during normal finalization", async () => {
    const { signer } = createSigner();
    const tx = btc.Transaction.fromPSBT(ccc.bytesFrom(createPsbt(WALLET)), {
      unknown: "ignore",
    });
    tx.addInput({ txid: new Uint8Array(32).fill(9), index: 0 });

    await expect(
      signer.signPsbt(ccc.hexFrom(tx.toPSBT()), {
        inputsToSign: [{ index: 0, address: WALLET.address }],
      }),
    ).rejects.toMatchObject({
      message: "Failed to finalize PSBT input #0.",
      cause: { message: "Cannot find previous output info" },
    });
  });

  it("should keep PSBT fields it does not know", async () => {
    const { signer } = createSigner();
    const tx = btc.Transaction.fromPSBT(ccc.bytesFrom(createPsbt(WALLET)), {
      unknown: "ignore",
    });
    tx.updateInput(0, {
      unknown: [
        [{ type: 0xee, key: new Uint8Array([1]) }, new Uint8Array([7])],
      ],
    });

    const signed = await signer.signPsbt(ccc.hexFrom(tx.toPSBT()));

    const [input] = inputsOf(signed);
    expect(input.finalScriptWitness).toBeDefined();
    expect(input.unknown).toHaveLength(1);
  });

  it("should require an address in inputsToSign", async () => {
    const { signer } = createSigner();

    await expect(
      signer.signPsbt(createPsbt(WALLET), {
        inputsToSign: [{ index: 0, publicKey: WALLET.publicKey }],
      }),
    ).rejects.toThrow("Xverse only supports signing with address");
  });
});

describe("Signer.signAndBroadcastPsbt", () => {
  it("should request the wallet to broadcast", async () => {
    const { signer, signPsbt } = createSigner();
    signPsbt.mockImplementationOnce((params) => ({
      psbt: params.psbt,
      txid: "ab".repeat(32),
    }));

    const txid = await signer.signAndBroadcastPsbt(createPsbt(WALLET), {
      inputsToSign: [{ index: 0, address: WALLET.address }],
    });

    expect(txid).toBe(`0x${"ab".repeat(32)}`);
    expect(signPsbt).toHaveBeenCalledWith(
      expect.objectContaining({
        signInputs: { [WALLET.address]: [0] },
        broadcast: true,
      }),
    );
  });
});
