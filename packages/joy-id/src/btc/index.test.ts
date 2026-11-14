import { ccc } from "@ckb-ccc/core";
import { decodeSearch } from "@joyid/common";
import { schnorr, secp256k1 } from "@noble/curves/secp256k1.js";
import * as btc from "@scure/btc-signer";
import { RawPSBTV0 } from "@scure/btc-signer/psbt.js";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createPopup } from "../common/index.js";
import {
  AccountSelector,
  Connection,
  ConnectionsRepo,
} from "../connectionsStorage/index.js";
import { BitcoinSigner } from "./index.js";

vi.mock("../common/index.js", () => ({
  createPopup: vi.fn(),
}));

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

const JOYID = createKey(1);
const OTHER = createKey(2);
// A native Taproot key-path output.
const TAPROOT_OUTPUT = ccc.bytesConcat([0x51, 0x20], JOYID.publicKey.slice(1));

class ConnectionsRepoMemory implements ConnectionsRepo {
  constructor(public connection?: Connection) {}

  async get(_selector: AccountSelector): Promise<Connection | undefined> {
    return this.connection;
  }

  async set(
    _selector: AccountSelector,
    connection: Connection | undefined,
  ): Promise<void> {
    this.connection = connection;
  }
}

function createSigner() {
  return new BitcoinSigner(
    CLIENT,
    "JoyID",
    "",
    undefined,
    "p2wpkh",
    undefined,
    new ConnectionsRepoMemory({
      address: JOYID.address,
      publicKey: ccc.hexFrom(JOYID.publicKey),
      keyType: "main_key",
    }),
    "btcTestnet",
  );
}

function createPsbt(
  scripts: Uint8Array[],
  presign: (tx: btc.Transaction) => void = () => {},
): ccc.Hex {
  const tx = new btc.Transaction({ unknown: "ignore" });
  scripts.forEach((script, i) => {
    tx.addInput({
      txid: new Uint8Array(32).fill(i + 1),
      index: 0,
      witnessUtxo: { script, amount: 10000n },
    });
  });
  tx.addOutputAddress(JOYID.address, 9000n, btc.TEST_NETWORK);
  presign(tx);
  return ccc.hexFrom(tx.toPSBT());
}

// A JoyID signature over a different message.
function staleJoyIdSignature(): [Uint8Array, Uint8Array] {
  const signature = secp256k1.sign(
    new Uint8Array(32).fill(9),
    JOYID.privateKey,
    { format: "der" },
  );
  return [JOYID.publicKey, ccc.bytesConcat(signature, [btc.SigHash.ALL])];
}

function inputsOf(psbtHex: ccc.Hex) {
  const tx = btc.Transaction.fromPSBT(ccc.bytesFrom(psbtHex), {
    unknown: "ignore",
  });
  return Array.from({ length: tx.inputsLength }, (_, i) => tx.getInput(i));
}

function requestSentTo(popup: string) {
  const data = new URL(popup).searchParams.get("_data_");
  return decodeSearch(data!) as Record<string, unknown>;
}

// Signs every JoyID input, replacing any existing JoyID signature.
function mockJoyIdSigning(
  sign: (tx: btc.Transaction) => void = (tx) => {
    for (let i = 0; i < tx.inputsLength; i++) {
      const { witnessUtxo, partialSig } = tx.getInput(i);
      if (
        !witnessUtxo ||
        ccc.hexFrom(witnessUtxo.script) !== ccc.hexFrom(JOYID.script)
      ) {
        continue;
      }
      const others = partialSig?.filter(
        ([pubkey]) => ccc.hexFrom(pubkey) !== ccc.hexFrom(JOYID.publicKey),
      );
      tx.updateInput(i, { partialSig: undefined });
      if (others?.length) {
        tx.updateInput(i, { partialSig: others });
      }
      tx.signIdx(JOYID.privateKey, i);
    }
  },
) {
  vi.mocked(createPopup).mockImplementation(async (popup) => {
    const tx = btc.Transaction.fromPSBT(
      ccc.bytesFrom(requestSentTo(popup).tx as string),
      { unknown: "ignore" },
    );
    sign(tx);
    return { tx: ccc.hexFrom(tx.toPSBT()).slice(2) };
  });
}

describe("BitcoinSigner.signPsbt", () => {
  beforeEach(() => {
    vi.stubGlobal("location", { href: "https://dapp.test/" });
    vi.mocked(createPopup).mockReset();
  });

  it.each([false, true])(
    "should handle wrapped SegWit (autoFinalized: %s)",
    async (autoFinalized) => {
      const wrapped = btc.p2sh(btc.p2wpkh(JOYID.publicKey));
      const tx = new btc.Transaction();
      tx.addInput({
        txid: new Uint8Array(32).fill(1),
        index: 0,
        witnessUtxo: { amount: 10000n, script: wrapped.script },
        redeemScript: wrapped.redeemScript,
      });
      tx.addOutput({ amount: 9000n, script: JOYID.script });
      const request = ccc.hexFrom(tx.toPSBT());
      tx.signIdx(JOYID.privateKey, 0);
      const signer = createSigner();
      vi.mocked(createPopup).mockResolvedValue({
        tx: ccc.hexFrom(tx.toPSBT()).slice(2),
      });
      const [input] = inputsOf(
        await signer.signPsbt(request, {
          autoFinalized,
          inputsToSign: [{ index: 0, address: JOYID.address }],
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
        witnessUtxo: { amount: 10000n, script: JOYID.script },
      });
      tx.addOutput({ amount: 9000n, script: JOYID.script });
      const request = ccc.hexFrom(tx.toPSBT());
      const raw = RawPSBTV0.decode(tx.toPSBT());
      raw.inputs[0].redeemScript = JOYID.script;
      const invalid = RawPSBTV0.encode(raw);
      const signer = createSigner();
      vi.mocked(createPopup).mockResolvedValue({
        tx: ccc.hexFrom(invalid).slice(2),
      });
      try {
        await signer.signPsbt(request, {
          autoFinalized,
          inputsToSign: [{ index: 0, address: JOYID.address }],
        });
        expect.fail("Invalid script metadata must be rejected");
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect(((error as Error).cause as Error).message).toContain(
          "redeemScript",
        );
      }
    },
  );

  describe.each([0, 2] as const)(
    "PSBT v%s Taproot key path with tree metadata",
    (version) => {
      it.each([0, 3, 0x83])(
        "should preserve/finalize input 1 with sighash %s",
        async (mode) => {
          const tree = btc.p2tr(schnorr.getPublicKey(JOYID.privateKey), {
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
            tx.addOutput({ amount: 9000n, script: JOYID.script });
          }
          tx.updateInput(1, { sighashType: mode });
          const request = ccc.hexFrom(tx.toPSBT());
          tx.signIdx(JOYID.privateKey, 1, [mode]);
          const signer = createSigner();
          vi.mocked(createPopup).mockResolvedValue({
            tx: ccc.hexFrom(tx.toPSBT()).slice(2),
          });
          for (const autoFinalized of [false, true]) {
            const [pending, signed] = inputsOf(
              await signer.signPsbt(request, {
                autoFinalized,
                inputsToSign: [
                  { index: 1, address: JOYID.address, sighashTypes: [mode] },
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
  it("should ask JoyID not to finalize and finalize locally by default", async () => {
    mockJoyIdSigning();
    const psbtHex = createPsbt([JOYID.script]);

    const signed = await createSigner().signPsbt(psbtHex);

    const request = requestSentTo(vi.mocked(createPopup).mock.calls[0][0]);
    expect(request).toMatchObject({
      tx: psbtHex.slice(2),
      signerAddress: JOYID.address,
      autoFinalized: false,
      options: { autoFinalized: false },
    });
    expect(request.options).not.toHaveProperty("toSignInputs");

    const [input] = inputsOf(signed);
    expect(input.finalScriptWitness).toBeDefined();
    expect(input.partialSig).toBeUndefined();
  });

  it("should return the partially signed PSBT when autoFinalized is false", async () => {
    mockJoyIdSigning();

    const signed = await createSigner().signPsbt(createPsbt([JOYID.script]), {
      autoFinalized: false,
    });

    const [input] = inputsOf(signed);
    expect(input.finalScriptWitness).toBeUndefined();
    expect(input.partialSig).toHaveLength(1);
  });

  it("should send inputsToSign as toSignInputs", async () => {
    mockJoyIdSigning();

    await createSigner().signPsbt(createPsbt([JOYID.script, OTHER.script]), {
      autoFinalized: false,
      inputsToSign: [
        { index: 0, address: JOYID.address },
        { index: 1, publicKey: "0xabcd", sighashTypes: [1] },
      ],
    });

    expect(
      requestSentTo(vi.mocked(createPopup).mock.calls[0][0]),
    ).toMatchObject({
      autoFinalized: false,
      options: {
        autoFinalized: false,
        toSignInputs: [
          { index: 0, address: JOYID.address },
          { index: 1, publicKey: "abcd", sighashTypes: [1] },
        ],
      },
    });
  });

  it("should only finalize the inputs JoyID signed", async () => {
    mockJoyIdSigning();

    const signed = await createSigner().signPsbt(
      createPsbt([JOYID.script, OTHER.script]),
    );

    const [mine, theirs] = inputsOf(signed);
    expect(mine.finalScriptWitness).toBeDefined();
    expect(theirs.finalScriptWitness).toBeUndefined();
    expect(theirs.partialSig).toBeUndefined();
  });

  it("should report missing UTXO data instead of finalizing in a scratch transaction", async () => {
    mockJoyIdSigning();
    const tx = new btc.Transaction();
    tx.addInput({
      txid: new Uint8Array(32).fill(1),
      index: 0,
      witnessUtxo: { script: JOYID.script, amount: 10000n },
    });
    tx.addInput({ txid: new Uint8Array(32).fill(2), index: 0 });
    tx.addOutputAddress(JOYID.address, 9000n, btc.TEST_NETWORK);

    await expect(
      createSigner().signPsbt(ccc.hexFrom(tx.toPSBT())),
    ).rejects.toMatchObject({
      message: "Failed to finalize PSBT input #0.",
      cause: { message: "Cannot find previous output info" },
    });
  });

  it("should keep PSBT fields it does not know", async () => {
    mockJoyIdSigning();
    const psbtHex = createPsbt([JOYID.script], (tx) =>
      tx.updateInput(0, {
        unknown: [
          [{ type: 0xee, key: new Uint8Array([1]) }, new Uint8Array([7])],
        ],
      }),
    );

    const signed = await createSigner().signPsbt(psbtHex);

    const [input] = inputsOf(signed);
    expect(input.finalScriptWitness).toBeDefined();
    expect(input.unknown).toHaveLength(1);
  });

  it("should finalize Taproot key-path inputs", async () => {
    mockJoyIdSigning((tx) =>
      tx.updateInput(0, {
        tapKeySig: schnorr.sign(
          tx.preimageWitnessV1(0, [TAPROOT_OUTPUT], 0, [10000n]),
          JOYID.privateKey,
        ),
      }),
    );

    const signed = await createSigner().signPsbt(createPsbt([TAPROOT_OUTPUT]));

    const [input] = inputsOf(signed);
    expect(input.finalScriptWitness).toBeDefined();
    expect(input.tapKeySig).toBeUndefined();
  });

  it("should finalize an input whose signature JoyID replaced", async () => {
    mockJoyIdSigning();
    const psbtHex = createPsbt([JOYID.script], (tx) =>
      tx.updateInput(0, { partialSig: [staleJoyIdSignature()] }),
    );

    const signed = await createSigner().signPsbt(psbtHex);

    expect(inputsOf(signed)[0].finalScriptWitness).toBeDefined();
  });

  it("should finalize ready P2WPKH inputs signed before the wallet call", async () => {
    mockJoyIdSigning();
    const psbtHex = createPsbt([JOYID.script, OTHER.script], (tx) =>
      tx.signIdx(OTHER.privateKey, 1),
    );

    const signed = await createSigner().signPsbt(psbtHex);

    const [mine, theirs] = inputsOf(signed);
    expect(mine.finalScriptWitness).toBeDefined();
    expect(theirs.finalScriptWitness).toBeDefined();
    expect(theirs.partialSig).toBeUndefined();
  });

  it("should leave unsigned requested inputs unchanged and finalize other ready inputs", async () => {
    mockJoyIdSigning();
    const signed = await createSigner().signPsbt(
      createPsbt([JOYID.script, OTHER.script]),
      {
        inputsToSign: [{ index: 1, address: OTHER.address }],
      },
    );
    const [ready, pending] = inputsOf(signed);
    expect(ready.finalScriptWitness).toBeDefined();
    expect(pending.finalScriptWitness).toBeUndefined();
    expect(pending.partialSig).toBeUndefined();
  });

  it("should leave Taproot inputs without a key-path signature unchanged", async () => {
    mockJoyIdSigning((tx) =>
      tx.updateInput(0, { partialSig: [staleJoyIdSignature()] }),
    );
    const signed = await createSigner().signPsbt(createPsbt([TAPROOT_OUTPUT]));
    expect(inputsOf(signed)[0].finalScriptWitness).toBeUndefined();
    expect(inputsOf(signed)[0].partialSig).toHaveLength(1);
  });

  it("should preserve finalized inputs while finalizing later ready inputs", async () => {
    const request = createPsbt([JOYID.script, JOYID.script], (tx) => {
      tx.signIdx(JOYID.privateKey, 0);
      tx.finalizeIdx(0);
      tx.signIdx(JOYID.privateKey, 1);
    });
    mockJoyIdSigning(() => {});
    const before = inputsOf(request)[0];
    const signed = await createSigner().signPsbt(request);
    expect(inputsOf(signed)[0]).toEqual(before);
    expect(inputsOf(signed)[1].finalScriptWitness).toBeDefined();
  });

  it("should leave a P2WPKH input with a nonmatching signature key unchanged", async () => {
    mockJoyIdSigning((tx) =>
      tx.updateInput(0, { partialSig: [staleJoyIdSignature()] }),
    );
    const signed = await createSigner().signPsbt(createPsbt([OTHER.script]));
    expect(inputsOf(signed)[0].finalScriptWitness).toBeUndefined();
    expect(inputsOf(signed)[0].partialSig).toHaveLength(1);
  });

  it("should surface unexpected finalizer errors for ready inputs", async () => {
    mockJoyIdSigning();
    const failure = new Error("Unexpected finalizer failure");
    const finalize = vi
      .spyOn(btc.Transaction.prototype, "finalizeIdx")
      .mockImplementationOnce(() => {
        throw failure;
      });
    try {
      await expect(
        createSigner().signPsbt(createPsbt([JOYID.script])),
      ).rejects.toMatchObject({
        message: "Failed to finalize PSBT input #0.",
        cause: failure,
      });
    } finally {
      finalize.mockRestore();
    }
  });

  it.each([true, false])(
    "should reject a raw transaction (autoFinalized: %s)",
    async (autoFinalized) => {
      vi.mocked(createPopup).mockResolvedValue({ tx: "02000000000101aabb" });

      await expect(
        createSigner().signPsbt(createPsbt([JOYID.script]), { autoFinalized }),
      ).rejects.toThrow("JoyID did not return a PSBT");
    },
  );

  it.each([true, false])(
    "should reject a corrupted PSBT (autoFinalized: %s)",
    async (autoFinalized) => {
      vi.mocked(createPopup).mockResolvedValue({ tx: "70736274ff0100aabb" });

      await expect(
        createSigner().signPsbt(createPsbt([JOYID.script]), { autoFinalized }),
      ).rejects.toThrow("JoyID returned an invalid PSBT");
    },
  );

  describe("inputs already signed by JoyID", () => {
    const presigned = () =>
      createPsbt([JOYID.script], (tx) => tx.signIdx(JOYID.privateKey, 0));

    it("should finalize an already signed input by default", async () => {
      mockJoyIdSigning();

      const signed = await createSigner().signPsbt(presigned());

      const [input] = inputsOf(signed);
      expect(input.finalScriptWitness).toBeDefined();
      expect(input.partialSig).toBeUndefined();
    });

    it("should finalize an already signed requested input", async () => {
      mockJoyIdSigning();
      const signed = await createSigner().signPsbt(presigned(), {
        inputsToSign: [{ index: 0, address: JOYID.address }],
      });
      expect(inputsOf(signed)[0].finalScriptWitness).toBeDefined();
    });
  });
});

describe("BitcoinSigner.signAndBroadcastPsbt", () => {
  beforeEach(() => {
    vi.stubGlobal("location", { href: "https://dapp.test/" });
    vi.mocked(createPopup).mockReset();
    vi.mocked(createPopup).mockResolvedValue({ tx: "ab".repeat(32) });
  });

  it("should force autoFinalized on and request broadcasting", async () => {
    const txid = await createSigner().signAndBroadcastPsbt("0x70736274ff", {
      autoFinalized: false,
      inputsToSign: [{ index: 0, address: JOYID.address }],
    });

    expect(txid).toBe(`0x${"ab".repeat(32)}`);
    expect(
      requestSentTo(vi.mocked(createPopup).mock.calls[0][0]),
    ).toMatchObject({
      isSend: true,
      autoFinalized: true,
      options: {
        autoFinalized: true,
        toSignInputs: [{ index: 0, address: JOYID.address }],
      },
    });
  });
});
