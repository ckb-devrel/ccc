import { afterEach, describe, expect, it, vi } from "vitest";
import { bytesConcat, bytesFrom } from "../../bytes/index.js";
import { OutPoint, Script, Transaction, WitnessArgs } from "../../ckb/index.js";
import { ClientPublicTestnet, KnownScript } from "../../client/index.js";
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
  outputLock?: Script;
  noOutput?: boolean;
  extra?: boolean;
};

// A lock proof: one input that cannot exist, one output under the lock, holding the message.
function proof(lock: Script, o: Options = {}) {
  const data = bytesFrom(MESSAGE, "utf8");
  const hash = hashCkb(
    bytesConcat(bytesFrom("CKB lock proof v1\n", "utf8"), lock.hash(), data),
  );
  const outputLock = o.outputLock ?? lock;
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
        cellOutput: { capacity: MAX, lock },
        outputData: "0x",
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
    outputs: o.noOutput
      ? []
      : [
          {
            capacity:
              BigInt(8 + outputLock.occupiedSize + data.length) * 100000000n,
            lock: outputLock,
          },
        ],
    outputsData: o.noOutput ? [] : [hexFrom(data)],
    witnesses: [],
  });
}

const key = (op: OutPoint) => `${op.txHash}:${op.index.toString()}`;

const owners: { dispose(): Promise<void> }[] = [];
afterEach(async () => {
  await Promise.all(owners.splice(0).map((o) => o.dispose()));
});

async function pair(seed = "11") {
  const client = new ClientPublicTestnet();
  const lookups: string[] = [];
  vi.spyOn(client, "getCell").mockImplementation(async (op) => {
    lookups.push(key(OutPoint.from(op)));
    return undefined;
  });
  vi.spyOn(client, "findCells").mockImplementation(
    async function* () {} as never,
  );
  const signer = new SignerCkbPrivateKey(client, `0x${seed.repeat(32)}`);
  const owner = SignerJsonRpcProviderSession.open({
    connect: async () => signer,
    confirmRequest: async () => true,
    getSigner: () => signer,
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
  return { dapp, signer, client, lookups, wire, lock };
}

// The witness holds a signature of the fixture key, for `lock`, over the sighash of the proof. The
// transaction that came back over the wire has no input cell, so the proof's own input is put back.
async function isSigned(
  signer: SignerCkbPrivateKey,
  lock: Script,
  signed: Transaction,
) {
  const unsigned = signed.clone();
  unsigned.inputs[0] = proof(lock).inputs[0].clone();
  unsigned.inputs[0].previousOutput = signed.inputs[0].previousOutput;
  await unsigned.prepareSighashAllWitness(lock, 65, signer.client);
  const info = await unsigned.getSignHashInfo(lock, signer.client);
  const signature =
    signed.witnesses.length > 0
      ? WitnessArgs.fromBytes(signed.witnesses[0]).lock
      : undefined;
  return (
    info !== undefined &&
    signature !== undefined &&
    verifyMessageSecp256k1(info.message, signature, signer.publicKey)
  );
}

// the wallet went to look the input up (and found nothing), so it did not rebuild its cell
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

describe("a pseudo input over the signer JSON-RPC", () => {
  it("control: direct signing without the wire signs the proof", async () => {
    const { signer, lock } = await pair();
    const prepared = await signer.prepareTransaction(proof(lock));
    expect(await isSigned(signer, lock, prepared)).toBe(false);
    const signed = await signer.signOnlyTransaction(prepared);
    expect(await isSigned(signer, lock, signed)).toBe(true);
  });

  it("the wallet signs it, with the bytes of direct signing, no lookup and nothing new on the wire", async () => {
    const { dapp, signer, lookups, wire, lock } = await pair();
    const direct = await signer.signOnlyTransaction(
      await signer.prepareTransaction(proof(lock)),
    );
    const signed = await dapp.signTransaction(proof(lock));
    expect(signed.witnesses[0]).toBe(direct.witnesses[0]);
    expect(await isSigned(signer, lock, signed)).toBe(true);
    expect(lookups).toEqual([]);
    expect(Object.keys(sentInput(wire)).sort()).toEqual([
      "previous_output",
      "since",
    ]);
  });

  it("prepare then sign works through the wire", async () => {
    const { dapp, signer, lookups, lock } = await pair();
    const prepared = await dapp.prepareTransaction(proof(lock));
    expect(await isSigned(signer, lock, prepared)).toBe(false);
    const signed = await dapp.signOnlyTransaction(prepared);
    expect(await isSigned(signer, lock, signed)).toBe(true);
    expect(lookups).toEqual([]);
  });

  it("the wallet signs for another of its locks, named by the first output", async () => {
    const { dapp, signer, client, lookups, lock } = await pair();
    const second = await Script.fromKnownScript(
      client,
      KnownScript.AnyoneCanPay,
      lock.args,
    );
    expect(second.eq(lock)).toBe(false);
    const signed = await dapp.signTransaction(proof(second));
    expect(await isSigned(signer, second, signed)).toBe(true);
    // the wallet prepared it as an input of that second lock: its cell deps are the lock's own
    const { cellDeps } = await client.getKnownScript(KnownScript.AnyoneCanPay);
    expect(signed.cellDeps.map((d) => d.outPoint.txHash)).toEqual(
      cellDeps.map((d) => d.cellDep.outPoint.txHash),
    );
    expect(lookups).toEqual([]);
  });

  it("a first output under a lock that is not the wallet's comes back unsigned", async () => {
    const other = await pair("22");
    const cases = {
      "another key's lock": other.lock,
      "a null lock": NULL_LOCK,
    };
    for (const outputLock of Object.values(cases)) {
      const { dapp, lookups, lock } = await pair();
      const signed = await dapp.signTransaction(proof(lock, { outputLock }));
      expect(signed.witnesses).toEqual([]);
      expect(lookups).toEqual([]);
    }
  });

  describe("anything but the exact shape is looked up", () => {
    const cases: Record<string, Options> = {
      "index 0": { index: 0 },
      "an all-zero tx hash": { txHash: `0x${"00".repeat(32)}` },
      "a tx hash shorter than 32 bytes": { txHash: "0x01" },
      "a second input next to it": { extra: true },
      "no output to take the lock from": { noOutput: true },
    };
    for (const [name, options] of Object.entries(cases)) {
      it(`control: ${name}`, async () => {
        const { dapp, lookups, lock } = await pair();
        const tx = proof(lock, options);
        await expect(dapp.signTransaction(tx)).rejects.toThrow(UNABLE);
        expect(looked(lookups, tx)).toBe(true);
      });
    }
  });

  it("a normal input is looked up, and its transaction is sent as before", async () => {
    const { dapp, lookups, wire, lock } = await pair();
    const tx = Transaction.from({
      inputs: [
        {
          previousOutput: { txHash: `0x${"ab".repeat(32)}`, index: 1 },
          since: 0,
        },
      ],
      outputs: [{ capacity: 100n * 100000000n, lock }],
      outputsData: ["0x"],
    });
    await expect(dapp.signTransaction(tx)).rejects.toThrow(UNABLE);
    expect(looked(lookups, tx)).toBe(true);
    expect(Object.keys(sentInput(wire)).sort()).toEqual([
      "previous_output",
      "since",
    ]);
  });
});
