import type { ccc } from "@ckb-ccc/connector-react";
import { describe, expect, it, vi } from "vitest";
import { execute } from "../src/app/execute";
import { MissingWalletError } from "../src/app/execute/wallet";

const client = { addressPrefix: "ckt" } as ccc.Client;

describe("wallet requirement during actual execution", () => {
  it("runs render/console/client code with an unused signer import", async () => {
    const log = vi.fn();
    await execute(
      `import { render, client, signer } from "@ckb-ccc/playground";
      const unused = signer;
      console.log(client.addressPrefix);
      await render("No wallet needed");`,
      async () => {},
      undefined,
      log,
      client,
    );
    expect(log.mock.calls.map((call) => call[2])).toEqual([
      ["ckt"],
      ["No wallet needed"],
    ]);
  });
  it("fails at signer use rather than module import and preserves earlier output", async () => {
    const log = vi.fn();
    await expect(
      execute(
        `import { signer } from "@ckb-ccc/playground";
      console.log("before wallet");
      await signer.getRecommendedAddress();
      console.log("must not continue");`,
        async () => {},
        undefined,
        log,
        client,
      ),
    ).rejects.toBeInstanceOf(MissingWalletError);
    expect(log.mock.calls.map((call) => call[2])).toEqual([["before wallet"]]);
  });
  it("exports the signer client instead of a newer page client", async () => {
    const signer = { client } as ccc.Signer;
    const log = vi.fn();
    await execute(
      `import { signer, client } from "@ckb-ccc/playground";
       console.log(client === signer.client, client.addressPrefix);`,
      async () => {},
      signer,
      log,
      { addressPrefix: "ckb" } as ccc.Client,
    );
    expect(log.mock.calls[0][2]).toEqual([true, "ckt"]);
  });
  it("runs manually with the provided connected signer", async () => {
    const log = vi.fn();
    const signer = {
      getRecommendedAddress: vi.fn(async () => "ckt-test-address"),
    } as unknown as ccc.Signer;
    await execute(
      `import { signer } from "@ckb-ccc/playground";
      console.log(await signer.getRecommendedAddress());`,
      async () => {},
      signer,
      log,
      client,
    );
    expect(log.mock.calls[0][2]).toEqual(["ckt-test-address"]);
    expect(signer.getRecommendedAddress).toHaveBeenCalledOnce();
  });
});
