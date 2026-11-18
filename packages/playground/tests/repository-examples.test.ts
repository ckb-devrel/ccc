import { ccc } from "@ckb-ccc/connector-react";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { RepositoryExamples } from "../src/app/components/RepositoryExamples";
import { EXAMPLES_REVISION, REPOSITORY_EXAMPLES } from "../src/app/examples";
import { execute } from "../src/app/execute";
import { MissingWalletError } from "../src/app/execute/wallet";

const pinnedBlobs: Record<string, string> = {
  "queryBalance.ts": "c0ebbba6ca1cc41b84da4f40e88f8c33cc5e1240",
  "queryCells.ts": "0c6b821f039f72a5c3bf1711f1117be99b6713e6",
  "queryTransactions.ts": "6776b12008c05e48d8370fd9f48e0e8ef5ea46e3",
};
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
    getKnownScript: vi.fn(async () => script),
    async *findCellsByLock() {},
    async *findTransactionsByLock() {
      yield { txHash: `0x${"11".repeat(32)}`, blockNumber: BigInt(1) };
    },
    getTip: vi.fn(async () => BigInt(2)),
    getTipHeader: vi.fn(async () => ({
      hash: `0x${"22".repeat(32)}`,
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
  } as unknown as ccc.Signer;
  return { client, signer };
}

describe("maintained repository examples", () => {
  it.each(REPOSITORY_EXAMPLES)(
    "executes $file with read-only fixture APIs",
    async (example) => {
      const source = readFileSync(
        new URL(`../../examples/src/${example.file}`, import.meta.url),
        "utf8",
      );
      // Fail if the locally tested source drifts from the immutable served revision.
      expect(EXAMPLES_REVISION).toBe(
        "7095ccad564b94ea2e59284cb4a364aa3499252e",
      );
      expect(
        createHash("sha1")
          .update(`blob ${Buffer.byteLength(source)}\0`)
          .update(source)
          .digest("hex"),
      ).toBe(pinnedBlobs[example.file]);
      expect(example.sourceUrl).toContain(`/${EXAMPLES_REVISION}/`);
      expect(example.sourceUrl).toContain(
        `/packages/examples/src/${example.file}`,
      );
      const { client, signer } = fixture();
      const log = vi.fn();
      await execute(source, async () => {}, signer, log, client);
      expect(log).toHaveBeenCalled();
      expect(log.mock.calls.every(([level]) => level === "info")).toBe(true);
      await expect(
        execute(source, async () => {}, undefined, vi.fn(), client),
      ).rejects.toBeInstanceOf(MissingWalletError);
    },
  );
  it("explains wallet/network and loading safety, disables repeated loads", () => {
    const html = renderToStaticMarkup(
      createElement(RepositoryExamples, { onLoad: vi.fn(), isLoading: true }),
    );
    expect(html).toContain("currently selected network");
    expect(html).toContain("do not sign or broadcast");
    expect(html).toContain("never runs code");
    expect(html.match(/disabled=""/g)).toHaveLength(3);
  });
});
