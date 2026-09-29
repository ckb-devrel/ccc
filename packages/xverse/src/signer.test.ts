import { ccc } from "@ckb-ccc/core";
import { secp256k1 } from "@noble/curves/secp256k1.js";
import * as btc from "@scure/btc-signer";
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

  it("should throw an actionable error when finalization fails", async () => {
    const { signer } = createSigner({ sign: false });

    await expect(signer.signPsbt(createPsbt(WALLET))).rejects.toThrow(
      "Use { autoFinalized: false }",
    );
  });

  it("should finalize without UTXO info on other signers' inputs", async () => {
    const { signer } = createSigner();
    const tx = btc.Transaction.fromPSBT(ccc.bytesFrom(createPsbt(WALLET)), {
      unknown: "ignore",
    });
    tx.addInput({ txid: new Uint8Array(32).fill(9), index: 0 });

    const signed = await signer.signPsbt(ccc.hexFrom(tx.toPSBT()), {
      inputsToSign: [{ index: 0, address: WALLET.address }],
    });

    const [mine, theirs] = inputsOf(signed);
    expect(mine.finalScriptWitness).toBeDefined();
    expect(theirs.finalScriptWitness).toBeUndefined();
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
