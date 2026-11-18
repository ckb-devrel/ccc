import { afterEach, describe, expect, it, vi } from "vitest";
import { bytesConcat, bytesFrom } from "../../bytes/index.js";
import { OutPoint, Script, Transaction, WitnessArgs } from "../../ckb/index.js";
import { ClientPublicTestnet } from "../../client/index.js";
import { hashCkb } from "../../hasher/index.js";
import { hexFrom } from "../../hex/index.js";
import {
  JsonRpcError,
  type JsonRpcPayload,
  type JsonRpcResponse,
  type JsonRpcTransport,
} from "../../jsonRpc/index.js";
import { SignerCkbPrivateKey, verifyMessageSecp256k1 } from "../ckb/index.js";
import { SignerJsonRpc, SignerJsonRpcProviderSession } from "./index.js";
import { SignerJsonRpcTransformers } from "./transformers.js";

const MAX = 0xffffffffffffffffn;
const NULL_LOCK = Script.from({
  codeHash: `0x${"00".repeat(32)}`,
  hashType: "data",
  args: "0x",
});
const MESSAGE = "example.com wants you to sign in\nNonce: 0123456789abcdef";
const UNABLE = /Unable to complete input/;

type Options = {
  index?: number;
  txHash?: string;
  capacity?: bigint;
  type?: Script;
  data?: string;
  extra?: boolean;
};

function proof(lock: Script, o: Options = {}) {
  const data = bytesFrom(MESSAGE, "utf8");
  const hash = hashCkb(
    bytesConcat(bytesFrom("CKB lock proof v0\n", "utf8"), lock.hash(), data),
  );
  return Transaction.from({
    version: 0,
    cellDeps: [],
    headerDeps: [],
    inputs: [
      {
        previousOutput: {
          txHash: o.txHash ?? hash,
          index: o.index ?? 0xffffffff,
        },
        since: 0,
        cellOutput: { capacity: o.capacity ?? MAX, lock, type: o.type },
        outputData: o.data ?? "0x",
      },
      ...(o.extra
        ? [
            {
              previousOutput: { txHash: `0x${"cd".repeat(32)}`, index: 0 },
              since: 0,
            },
          ]
        : []),
    ],
    outputs: [
      { capacity: BigInt(8 + 33 + data.length) * 100000000n, lock: NULL_LOCK },
    ],
    outputsData: [hexFrom(data)],
    witnesses: [],
  });
}

const key = (op: OutPoint) => `${op.txHash}:${op.index.toString()}`;

const owners: { dispose(): Promise<void> }[] = [];
afterEach(async () => {
  await Promise.all(owners.splice(0).map((o) => o.dispose()));
});

async function pair(acceptPseudoInputs?: boolean) {
  const client = new ClientPublicTestnet();
  const lookups: string[] = [];
  vi.spyOn(client, "getCell").mockImplementation(async (op) => {
    lookups.push(key(OutPoint.from(op)));
    return undefined;
  });
  vi.spyOn(client, "findCells").mockImplementation(
    async function* () {} as never,
  );
  const signer = new SignerCkbPrivateKey(client, `0x${"11".repeat(32)}`);
  const owner = SignerJsonRpcProviderSession.open({
    connect: async () => signer,
    confirmRequest: async () => true,
    getSigner: () => signer,
    ...(acceptPseudoInputs === undefined ? {} : { acceptPseudoInputs }),
  });
  owners.push(owner);
  const wire: JsonRpcPayload[] = [];
  const transport: JsonRpcTransport = {
    async request(payload): Promise<JsonRpcResponse> {
      const sent = JSON.parse(JSON.stringify(payload)) as JsonRpcPayload;
      wire.push(sent);
      try {
        const result = JSON.parse(
          JSON.stringify(await owner.value.handle(sent)) ?? "null",
        ) as unknown;
        return { jsonrpc: "2.0", id: payload.id, result };
      } catch (e) {
        const code = e instanceof JsonRpcError ? e.code : -32000;
        return {
          jsonrpc: "2.0",
          id: payload.id,
          error: { code, message: (e as Error).message },
        };
      }
    },
  };
  const dappClient = new ClientPublicTestnet();
  vi.spyOn(dappClient, "getCell").mockRejectedValue(
    new Error("the dApp must not look up"),
  );
  const dapp = await SignerJsonRpc.new(dappClient, { transport });
  await dapp.connect();
  const lock = (await signer.getAddressObjSecp256k1()).script;
  const { session_id } = (wire.at(-1)!.params as [{ session_id: string }])[0];
  let raws = 0;
  const raw = (method: string, param: unknown) =>
    Promise.resolve(
      owner.value.handle({
        jsonrpc: "2.0",
        id: 0,
        method,
        params: [{ request_id: `raw-${raws++}`, session_id }, param],
      }),
    );
  return { dapp, signer, lookups, wire, lock, raw };
}

// the witness holds a signature of the fixture key over the sighash of the transaction
async function isSigned(signer: SignerCkbPrivateKey, signed: Transaction) {
  const lock = (await signer.getAddressObjSecp256k1()).script;
  const unsigned = signed.clone();
  await unsigned.prepareSighashAllWitness(lock, 65, signer.client);
  const info = await unsigned.getSignHashInfo(lock, signer.client);
  const signature = WitnessArgs.fromBytes(signed.witnesses[0]).lock;
  return (
    info !== undefined &&
    signature !== undefined &&
    verifyMessageSecp256k1(info.message, signature, signer.publicKey)
  );
}

// the wallet went to look the fake input up (and found nothing), so it did not accept the carried cell
const looked = (lookups: string[], tx: Transaction) =>
  lookups.includes(key(tx.inputs[0].previousOutput));

// params are [request metadata, transaction]
const sentInput = (wire: JsonRpcPayload[]) =>
  (
    wire.find(
      (p) =>
        p.method === "prepare_transaction" || p.method === "sign_transaction",
    )?.params as [unknown, { inputs: Record<string, unknown>[] }]
  )[1].inputs[0];

describe("a lock proof input over the signer JSON-RPC", () => {
  it("control: direct signing without the wire signs the template", async () => {
    const { signer, lock } = await pair();
    const prepared = await signer.prepareTransaction(proof(lock));
    expect(await isSigned(signer, prepared)).toBe(false);
    const signed = await signer.signOnlyTransaction(prepared);
    expect(await isSigned(signer, signed)).toBe(true);
  });

  it("a wallet that opted in signs it, with the bytes of direct signing and no lookup", async () => {
    const { dapp, signer, lookups, lock } = await pair(true);
    const direct = await signer.signOnlyTransaction(
      await signer.prepareTransaction(proof(lock)),
    );
    const signed = await dapp.signTransaction(proof(lock));
    expect(signed.witnesses[0]).toBe(direct.witnesses[0]);
    expect(await isSigned(signer, signed)).toBe(true);
    expect(lookups).toEqual([]);
  });

  it("prepare then sign works through the wire", async () => {
    const { dapp, signer, lookups, lock } = await pair(true);
    const prepared = await dapp.prepareTransaction(proof(lock));
    expect(prepared.inputs[0].cellOutput?.capacity).toBe(MAX);
    expect(await isSigned(signer, prepared)).toBe(false);
    const signed = await dapp.signOnlyTransaction(prepared);
    expect(await isSigned(signer, signed)).toBe(true);
    expect(lookups).toEqual([]);
  });

  it("a wallet that did not opt in refuses it and looks the input up", async () => {
    for (const accept of [undefined, false]) {
      const { dapp, lookups, lock } = await pair(accept);
      const tx = proof(lock);
      await expect(dapp.signTransaction(tx)).rejects.toThrow(UNABLE);
      expect(looked(lookups, tx)).toBe(true);
    }
  });

  describe("when the wallet opted in, anything but the exact shape is looked up", () => {
    const typeScript = Script.from({
      codeHash: `0x${"22".repeat(32)}`,
      hashType: "type",
      args: "0x",
    });
    const cases: Record<string, Options> = {
      "index 0": { index: 0 },
      "capacity below u64::MAX": { capacity: MAX - 1n },
      "a type script": { type: typeScript },
      "non-empty data": { data: "0x01" },
      "an all-zero tx hash": { txHash: `0x${"00".repeat(32)}` },
      "a tx hash shorter than 32 bytes": { txHash: "0x01" },
      "a second input next to it": { extra: true },
    };
    for (const [name, options] of Object.entries(cases)) {
      it(`control: ${name}`, async () => {
        const { dapp, lookups, lock } = await pair(true);
        const tx = proof(lock, options);
        await expect(dapp.signTransaction(tx)).rejects.toThrow(UNABLE);
        expect(looked(lookups, tx)).toBe(true);
      });
    }
  });

  it("a normal input keeps exactly its out point and since on the wire", async () => {
    const { dapp, wire, lock } = await pair(true);
    await dapp
      .signTransaction(
        Transaction.from({
          inputs: [
            {
              previousOutput: { txHash: `0x${"ab".repeat(32)}`, index: 1 },
              since: 0,
            },
          ],
          outputs: [{ capacity: 100n * 100000000n, lock }],
          outputsData: ["0x"],
        }),
      )
      .catch(() => undefined);
    expect(Object.keys(sentInput(wire)).sort()).toEqual([
      "previous_output",
      "since",
    ]);
  });

  it("extra fields on a normal input are ignored and the input is looked up", async () => {
    const { lookups, lock, raw } = await pair(true);
    const tx = Transaction.from({
      inputs: [
        {
          previousOutput: { txHash: `0x${"ab".repeat(32)}`, index: 0 },
          since: 0,
        },
      ],
      outputs: [{ capacity: 100n * 100000000n, lock }],
      outputsData: ["0x"],
    });
    const json = SignerJsonRpcTransformers.transactionFrom(tx);
    const sent = {
      ...json,
      inputs: [{ ...json.inputs[0], cell_output: {}, output_data: "0x" }],
    };
    await expect(raw("sign_transaction", sent)).rejects.toThrow(UNABLE);
    expect(looked(lookups, tx)).toBe(true);
  });

  it("a proof input that fails the rule is sent without a cell", async () => {
    const { dapp, wire, lock } = await pair(true);
    await dapp
      .signTransaction(proof(lock, { index: 0 }))
      .catch(() => undefined);
    const input = sentInput(wire);
    expect("cell_output" in input).toBe(false);
    expect("output_data" in input).toBe(false);
  });
});
