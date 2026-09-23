import { ccc } from "@ckb-ccc/core";
import { decodeSearch } from "@joyid/common";
import { secp256k1 } from "@noble/curves/secp256k1.js";
import { networks, payments, Psbt, script, Transaction } from "bitcoinjs-lib";
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

const JOYID = createKey(1);
const OTHER = createKey(2);
// Key-path finalization only needs a valid x-only key.
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
  outputs: Uint8Array[],
  presign: (psbt: Psbt) => void = () => {},
): ccc.Hex {
  const psbt = new Psbt({ network: NETWORK });
  outputs.forEach((output, i) => {
    psbt.addInput({
      hash: new Uint8Array(32).fill(i + 1),
      index: 0,
      witnessUtxo: { script: output, value: 10000n },
    });
  });
  psbt.addOutput({ address: JOYID.address, value: 9000n });
  presign(psbt);
  return ccc.hexFrom(psbt.toBuffer());
}

// A JoyID signature over a different message.
function staleJoyIdSignature() {
  return {
    pubkey: JOYID.publicKey,
    signature: script.signature.encode(
      JOYID.signer.sign(new Uint8Array(32).fill(9)),
      Transaction.SIGHASH_ALL,
    ),
  };
}

function parse(psbtHex: ccc.Hex) {
  return Psbt.fromBuffer(ccc.bytesFrom(psbtHex), { network: NETWORK });
}

function requestSentTo(popup: string) {
  const data = new URL(popup).searchParams.get("_data_");
  return decodeSearch(data!) as Record<string, unknown>;
}

// Signs every JoyID input, replacing any existing JoyID signature.
function mockJoyIdSigning(
  sign: (psbt: Psbt) => void = (psbt) =>
    psbt.data.inputs.forEach((input, index) => {
      if (
        ccc.hexFrom(input.witnessUtxo!.script) !== ccc.hexFrom(JOYID.output)
      ) {
        return;
      }
      input.partialSig = input.partialSig?.filter(
        ({ pubkey }) => ccc.hexFrom(pubkey) !== ccc.hexFrom(JOYID.publicKey),
      );
      if (!input.partialSig?.length) {
        delete input.partialSig;
      }
      psbt.signInput(index, JOYID.signer);
    }),
) {
  vi.mocked(createPopup).mockImplementation(async (popup) => {
    const psbt = Psbt.fromHex(requestSentTo(popup).tx as string, {
      network: NETWORK,
    });
    sign(psbt);
    return { tx: psbt.toHex() };
  });
}

describe("BitcoinSigner.signPsbt", () => {
  beforeEach(() => {
    vi.stubGlobal("location", { href: "https://dapp.test/" });
    vi.mocked(createPopup).mockReset();
  });

  it("should ask JoyID not to finalize and finalize locally by default", async () => {
    mockJoyIdSigning();
    const psbtHex = createPsbt([JOYID.output]);

    const signed = await createSigner().signPsbt(psbtHex);

    const request = requestSentTo(vi.mocked(createPopup).mock.calls[0][0]);
    expect(request).toMatchObject({
      tx: psbtHex.slice(2),
      signerAddress: JOYID.address,
      autoFinalized: false,
      options: { autoFinalized: false },
    });
    expect(request.options).not.toHaveProperty("toSignInputs");

    const [input] = parse(signed).data.inputs;
    expect(input.finalScriptWitness).toBeDefined();
    expect(input.partialSig).toBeUndefined();
  });

  it("should return the partially signed PSBT when autoFinalized is false", async () => {
    mockJoyIdSigning();

    const signed = await createSigner().signPsbt(createPsbt([JOYID.output]), {
      autoFinalized: false,
    });

    const [input] = parse(signed).data.inputs;
    expect(input.finalScriptWitness).toBeUndefined();
    expect(input.partialSig).toHaveLength(1);
  });

  it("should send inputsToSign as toSignInputs", async () => {
    mockJoyIdSigning();

    await createSigner().signPsbt(createPsbt([JOYID.output, OTHER.output]), {
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
      createPsbt([JOYID.output, OTHER.output]),
    );

    const [mine, theirs] = parse(signed).data.inputs;
    expect(mine.finalScriptWitness).toBeDefined();
    expect(theirs.finalScriptWitness).toBeUndefined();
    expect(theirs.partialSig).toBeUndefined();
  });

  it("should finalize Taproot key-path inputs", async () => {
    mockJoyIdSigning((psbt) =>
      psbt.updateInput(0, { tapKeySig: new Uint8Array(64).fill(1) }),
    );

    const signed = await createSigner().signPsbt(createPsbt([TAPROOT_OUTPUT]));

    const [input] = parse(signed).data.inputs;
    expect(input.finalScriptWitness).toBeDefined();
    expect(input.tapKeySig).toBeUndefined();
  });

  it("should finalize an input whose signature JoyID replaced", async () => {
    mockJoyIdSigning();
    const psbtHex = createPsbt([JOYID.output], (psbt) =>
      psbt.updateInput(0, { partialSig: [staleJoyIdSignature()] }),
    );

    const signed = await createSigner().signPsbt(psbtHex);

    expect(parse(signed).data.inputs[0].finalScriptWitness).toBeDefined();
  });

  it("should not finalize inputs signed only by other signers", async () => {
    mockJoyIdSigning();
    const psbtHex = createPsbt([JOYID.output, OTHER.output], (psbt) =>
      psbt.signInput(1, OTHER.signer),
    );

    const signed = await createSigner().signPsbt(psbtHex);

    const [mine, theirs] = parse(signed).data.inputs;
    expect(mine.finalScriptWitness).toBeDefined();
    expect(theirs.finalScriptWitness).toBeUndefined();
    expect(theirs.partialSig).toHaveLength(1);
  });

  it("should throw when JoyID skips a requested input signed by others", async () => {
    mockJoyIdSigning();
    const psbtHex = createPsbt([JOYID.output, OTHER.output], (psbt) =>
      psbt.signInput(1, OTHER.signer),
    );

    await expect(
      createSigner().signPsbt(psbtHex, {
        inputsToSign: [
          { index: 0, address: JOYID.address },
          { index: 1, address: OTHER.address },
        ],
      }),
    ).rejects.toThrow(
      "JoyID did not add a signature to the requested input #1",
    );
  });

  it("should throw when JoyID skips an unsigned requested input", async () => {
    mockJoyIdSigning();

    await expect(
      createSigner().signPsbt(createPsbt([JOYID.output, OTHER.output]), {
        inputsToSign: [{ index: 1, address: OTHER.address }],
      }),
    ).rejects.toThrow(
      "JoyID did not add a signature to the requested input #1",
    );
  });

  it("should suggest autoFinalized false when finalizing fails", async () => {
    mockJoyIdSigning((psbt) =>
      psbt.updateInput(0, { partialSig: [staleJoyIdSignature()] }),
    );

    await expect(
      createSigner().signPsbt(createPsbt([TAPROOT_OUTPUT])),
    ).rejects.toThrow("Use { autoFinalized: false }");
  });

  it.each([true, false])(
    "should reject a raw transaction (autoFinalized: %s)",
    async (autoFinalized) => {
      vi.mocked(createPopup).mockResolvedValue({ tx: "02000000000101aabb" });

      await expect(
        createSigner().signPsbt(createPsbt([JOYID.output]), { autoFinalized }),
      ).rejects.toThrow("JoyID did not return a PSBT");
    },
  );

  it.each([true, false])(
    "should reject a corrupted PSBT (autoFinalized: %s)",
    async (autoFinalized) => {
      vi.mocked(createPopup).mockResolvedValue({ tx: "70736274ff0100aabb" });

      await expect(
        createSigner().signPsbt(createPsbt([JOYID.output]), { autoFinalized }),
      ).rejects.toThrow("JoyID returned an invalid PSBT");
    },
  );

  it.each([true, false])(
    "should reject a PSBT for a different transaction (autoFinalized: %s)",
    async (autoFinalized) => {
      vi.mocked(createPopup).mockResolvedValue({
        tx: createPsbt([OTHER.output, OTHER.output]).slice(2),
      });

      await expect(
        createSigner().signPsbt(createPsbt([JOYID.output]), { autoFinalized }),
      ).rejects.toThrow("different transaction");
    },
  );

  describe("inputs already signed by JoyID (unsupported)", () => {
    const presigned = () =>
      createPsbt([JOYID.output], (psbt) => psbt.signInput(0, JOYID.signer));

    it("should leave the input unfinalized by default", async () => {
      mockJoyIdSigning();

      const signed = await createSigner().signPsbt(presigned());

      const [input] = parse(signed).data.inputs;
      expect(input.finalScriptWitness).toBeUndefined();
      expect(input.partialSig).toHaveLength(1);
    });

    it("should report the requested input as not signed", async () => {
      mockJoyIdSigning();

      await expect(
        createSigner().signPsbt(presigned(), {
          inputsToSign: [{ index: 0, address: JOYID.address }],
        }),
      ).rejects.toThrow(
        "JoyID did not add a signature to the requested input #0",
      );
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
