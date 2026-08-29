import { describe, expect, it } from "vitest";
import { signerJsonRpcNetworkIdFromAddressPrefix } from "./network.js";

describe("signerJsonRpcNetworkIdFromAddressPrefix", () => {
  it.each([
    ["ckb", "ckb-mainnet"],
    ["ckt", "ckb-testnet"],
  ])("maps %s to %s", (addressPrefix, networkId) => {
    expect(signerJsonRpcNetworkIdFromAddressPrefix(addressPrefix)).toBe(
      networkId,
    );
  });

  it("rejects unsupported address prefixes", () => {
    expect(() => signerJsonRpcNetworkIdFromAddressPrefix("custom")).toThrow(
      "Unsupported address prefix: custom",
    );
  });
});
