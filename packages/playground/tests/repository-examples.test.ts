import { ccc } from "@ckb-ccc/connector-react";
import { sporeA } from "@ckb-ccc/spore/advanced";
import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { RepositoryExamples } from "../src/app/components/RepositoryExamples";
import { REPOSITORY_EXAMPLES } from "../src/app/examples";
import { execute } from "../src/app/execute";
import { MissingWalletError } from "../src/app/execute/wallet";

const script = ccc.Script.from({
  codeHash: `0x${"00".repeat(32)}`,
  hashType: "type",
  args: "0x",
});
const address = ccc.Address.from({ prefix: "ckt", script });
function fixture() {
  const client = {
    addressPrefix: "ckt",
    getBalanceSingle: vi.fn(async () => BigInt(100)),
    getBalance: vi.fn(async () => BigInt(100)),
    getKnownScript: vi.fn(async () => ({ ...script, cellDeps: [] })),
    getCellDeps: vi.fn(async () => [
      {
        outPoint: ccc.OutPoint.from({
          txHash: `0x${"aa".repeat(32)}`,
          index: 0,
        }),
        depType: "code",
      },
    ]),
    sendTransaction: vi.fn(),
    async *findCellsByLock() {},
    async *findCells() {},
    findSingletonCellByType: vi.fn(async () => undefined),
    async *findTransactionsByLock() {
      yield { txHash: `0x${"11".repeat(32)}`, blockNumber: BigInt(1) };
    },
    getTip: vi.fn(async () => BigInt(2)),
    getTipHeader: vi.fn(async () => ({
      hash: `0x${"22".repeat(32)}`,
      number: BigInt(2),
      epoch: [BigInt(1), BigInt(0), BigInt(1)],
    })),
  } as unknown as ccc.Client;
  const signer = {
    client,
    getRecommendedAddress: vi.fn(async () => address.toString()),
    getRecommendedAddressObj: vi.fn(async () => address),
    getAddressObjs: vi.fn(async () => [address]),
    getBalance: vi.fn(async () => BigInt(100)),
    async *findCells() {},
    prepareTransaction: vi.fn(async (tx) => tx),
    signTransaction: vi.fn(),
    sendTransaction: vi.fn(),
  } as unknown as ccc.Signer;
  return { client, signer };
}

function readExample(file: string) {
  return readFileSync(
    new URL(`../../examples/src/${file}`, import.meta.url),
    "utf8",
  );
}

function previewOnly() {
  const fill = vi
    .spyOn(ccc.Transaction.prototype, "completeInputsByCapacity")
    .mockImplementation(async () => 0);
  const fee = vi
    .spyOn(ccc.Transaction.prototype, "completeFeeBy")
    .mockImplementation(async () => [0, true]);
  return { fill, fee };
}

function transactionsIn(log: ReturnType<typeof vi.fn>) {
  return log.mock.calls.flat(2).filter((v) => v instanceof ccc.Transaction);
}

afterEach(() => vi.restoreAllMocks());

describe("maintained repository examples", () => {
  it.each(REPOSITORY_EXAMPLES)(
    "executes $file with read-only fixture APIs",
    async (example) => {
      // Exercise the local repository source without fetching a moving branch in CI.
      const source = readExample(example.file);
      expect(example.sourceUrl).toBe(
        `https://raw.githubusercontent.com/ckb-devrel/ccc/master/packages/examples/src/${example.file}`,
      );
      const { client, signer } = fixture();
      const { fill, fee } = previewOnly();
      const log = vi.fn();
      const run = execute(source, async () => {}, signer, log, client);
      if (example.file === "transferUdt.ts") {
        await expect(run).rejects.toBeInstanceOf(
          ccc.ErrorTransactionInsufficientCoin,
        );
        expect(transactionsIn(log)).toHaveLength(1);
      } else {
        await run;
      }
      expect(log).toHaveBeenCalled();
      expect(log.mock.calls.every(([level]) => level === "info")).toBe(true);
      await expect(
        execute(source, async () => {}, undefined, vi.fn(), client),
      ).rejects.toBeInstanceOf(MissingWalletError);
      if (example.file === "transfer.ts") {
        expect(fill).toHaveBeenCalledWith(signer);
        expect(fee).toHaveBeenCalledWith(signer);
        expect(transactionsIn(log)).toHaveLength(3);
      }
      if (example.file === "queryTransactions.ts") {
        expect(client.getTip).toHaveBeenCalledOnce();
        expect(log.mock.calls.flat(2).map(String).join(" ")).toContain(
          "Current tip block: 2",
        );
      }
      if (example.file === "transferSpore.ts") {
        expect(log.mock.calls.flat(2)).toContain("Found 0 Spore(s)");
        expect(transactionsIn(log)).toHaveLength(0);
      }
      expect(signer.signTransaction).not.toHaveBeenCalled();
      expect(signer.sendTransaction).not.toHaveBeenCalled();
      expect(client.sendTransaction).not.toHaveBeenCalled();
    },
  );
  it.each(["resolveDid.ts", "didHistory.ts"])(
    "executes %s with a real encoded DID fixture",
    async (file) => {
      const { client, signer } = fixture();
      const id = ccc.didCkb.didToArgs(
        "did:ckb:qq2m72a2vas4e5ovcpxoedscguuu4nba",
      );
      const cell = ccc.Cell.from({
        outPoint: { txHash: `0x${"33".repeat(32)}`, index: 0 },
        cellOutput: {
          capacity: ccc.fixedPointFrom(200),
          lock: script,
          type: { ...script, args: id },
        },
        outputData: ccc.hexFrom(
          ccc.didCkb.DidCkbData.fromV1({
            document: { id: "fixture" },
          }).toBytes(),
        ),
      });
      client.findSingletonCellByType = vi.fn(async () => cell);
      client.findCells = async function* () {
        yield cell;
      };
      client.getTransaction = vi.fn(async () =>
        ccc.ClientTransactionResponse.from({
          status: "committed",
          transaction: ccc.Transaction.from({
            outputs: [cell.cellOutput],
            outputsData: [cell.outputData],
          }),
          blockNumber: BigInt(1),
        }),
      );
      const source = readExample(file);
      const log = vi.fn();
      await execute(source, async () => {}, signer, log, client);
      const text = log.mock.calls.flat(2).map(String).join(" ");
      expect(text).toContain(
        file === "resolveDid.ts" ? "Address controls 1 DID" : "[CREATE]",
      );
      expect(log.mock.calls.every(([level]) => level === "info")).toBe(true);
    },
  );
  it("builds an unsigned xUDT transfer with a matching funded fixture", async () => {
    const { client, signer } = fixture();
    previewOnly();
    signer.findCells = async function* ({ script: type } = {}) {
      yield ccc.Cell.from({
        outPoint: { txHash: `0x${"44".repeat(32)}`, index: 0 },
        cellOutput: { capacity: ccc.fixedPointFrom(200), lock: script, type },
        outputData: ccc.hexFrom(ccc.numLeToBytes(ccc.fixedPointFrom(1), 16)),
      });
    };
    const log = vi.fn();
    await execute(
      readExample("transferUdt.ts"),
      async () => {},
      signer,
      log,
      client,
    );
    expect(transactionsIn(log)).toHaveLength(4);
    expect(transactionsIn(log).at(-1)?.inputs).toHaveLength(1);
    expect(signer.signTransaction).not.toHaveBeenCalled();
    expect(signer.sendTransaction).not.toHaveBeenCalled();
    expect(client.sendTransaction).not.toHaveBeenCalled();
  });

  it("builds an unsigned transfer for an owned Spore fixture", async () => {
    const { client, signer } = fixture();
    previewOnly();
    const { spore } = (await import("@ckb-ccc/ccc")).ccc;
    const id = ccc.hexFrom(`0x${"55".repeat(32)}`);
    const info = spore.getSporeScriptInfo(client);
    const cell = ccc.Cell.from({
      outPoint: { txHash: `0x${"66".repeat(32)}`, index: 0 },
      cellOutput: {
        capacity: ccc.fixedPointFrom(200),
        lock: script,
        type: { ...info, args: id },
      },
      outputData: ccc.hexFrom(
        sporeA.packRawSporeData({
          contentType: "text/plain",
          content: new TextEncoder().encode("fixture"),
        }),
      ),
    });
    signer.findCells = async function* ({ script: type } = {}) {
      if (type?.codeHash === info.codeHash) yield cell;
    };
    client.findSingletonCellByType = vi.fn(async (type) =>
      type.codeHash === info.codeHash ? cell : undefined,
    );
    const log = vi.fn();
    await execute(
      readExample("transferSpore.ts"),
      async () => {},
      signer,
      log,
      client,
    );
    expect(log.mock.calls.flat(2)).toContain("Found 1 Spore(s)");
    expect(transactionsIn(log)).toHaveLength(1);
    expect(transactionsIn(log)[0]?.outputs[0]?.type?.args).toBe(id);
    expect(signer.signTransaction).not.toHaveBeenCalled();
    expect(signer.sendTransaction).not.toHaveBeenCalled();
    expect(client.sendTransaction).not.toHaveBeenCalled();
  });

  it("explains wallet/network and loading safety, disables repeated loads", () => {
    const html = renderToStaticMarkup(
      createElement(RepositoryExamples, { onLoad: vi.fn(), isLoading: true }),
    );
    expect(html).toContain("selected network");
    expect(html).toContain("never signs or broadcasts");
    expect(html).not.toContain("Read from the chain");
    expect(REPOSITORY_EXAMPLES[0].file).toBe("transfer.ts");
    expect(html).toContain("never runs");
    expect(html).toContain("master branch");
    expect(html.match(/disabled=""/g)).toHaveLength(REPOSITORY_EXAMPLES.length);
  });
});
