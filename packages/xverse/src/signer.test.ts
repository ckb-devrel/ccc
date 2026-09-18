import { ccc } from "@ckb-ccc/core";
import { secp256k1 } from "@noble/curves/secp256k1.js";
import { networks, payments, Psbt } from "bitcoinjs-lib";
import { describe, expect, it, vi } from "vitest";
import {
  AddressPurpose,
  AddressType,
  BtcProvider,
  SignPsbtParams,
} from "./advancedBarrel.js";
import { Signer } from "./signer.js";

const NETWORK = networks.testnet;
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
  const { address, output } = payments.p2wpkh({
    pubkey: publicKey,
    network: NETWORK,
  });
  return {
    address: address!,
    publicKey,
    output: output!,
    signer: {
      publicKey,
      sign: (hash: Uint8Array) => secp256k1.sign(hash, privateKey),
    },
  };
}

const WALLET = createKey(1);
const OTHER = createKey(2);

function createPsbt(...inputs: { output: Uint8Array }[]): ccc.Hex {
  const psbt = new Psbt({ network: NETWORK });
  inputs.forEach(({ output }, i) => {
    psbt.addInput({
      hash: new Uint8Array(32).fill(i + 1),
      index: 0,
      witnessUtxo: { script: output, value: 10000n },
    });
  });
  psbt.addOutput({ address: WALLET.address, value: 9000n });
  return ccc.hexFrom(psbt.toBuffer());
}

function createSigner({ sign = true } = {}) {
  const signPsbt = vi.fn((params: SignPsbtParams) => {
    const psbt = Psbt.fromBase64(params.psbt, { network: NETWORK });
    if (sign) {
      Object.entries(params.signInputs).forEach(([address, indexes]) => {
        expect(address).toBe(WALLET.address);
        indexes.forEach((index) => psbt.signInput(index, WALLET.signer));
      });
    }
    return { psbt: psbt.toBase64() };
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

function parseSigned(signed: ccc.Hex) {
  return Psbt.fromBuffer(ccc.bytesFrom(signed), { network: NETWORK });
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
    const [input] = parseSigned(signed).data.inputs;
    expect(input.finalScriptWitness).toBeDefined();
    expect(input.partialSig).toBeUndefined();
  });

  it("should return the partially signed PSBT when autoFinalized is false", async () => {
    const { signer } = createSigner();

    const signed = await signer.signPsbt(createPsbt(WALLET), {
      autoFinalized: false,
    });

    const [input] = parseSigned(signed).data.inputs;
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
    const [mine, theirs] = parseSigned(signed).data.inputs;
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
