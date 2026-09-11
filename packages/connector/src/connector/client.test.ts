import { ccc } from "@ckb-ccc/ccc";
import { describe, expect, it } from "vitest";
import { ClientWithFeeRate } from "./client.js";

describe("ClientWithFeeRate", () => {
  it("wraps the initial client once so signers retain the fee-rate proxy", async () => {
    const originalClient = new ccc.ClientPublicTestnet();
    const client = ClientWithFeeRate.from(originalClient);
    client.feeRate = 2_000n;

    expect(client[ccc.Proxy.inner]).toBe(originalClient);
    expect(ClientWithFeeRate.from(client)).toBe(client);
    await expect(client.getFeeRate()).resolves.toBe(2_000n);
  });
});
