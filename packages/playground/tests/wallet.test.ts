import type { ccc } from "@ckb-ccc/connector-react";
import { describe, expect, it, vi } from "vitest";
import {
  createWalletBindings,
  MissingWalletError,
  requestWalletConnection,
} from "../src/app/execute/wallet";

const client = { addressPrefix: "ckt" } as ccc.Client;

describe("runtime wallet bindings", () => {
  it("allows client-only code and unused signer destructuring without a wallet", () => {
    const bindings = createWalletBindings(client, undefined);
    const { signer, client: runtimeClient } = bindings;
    expect(signer).toBeDefined();
    expect(runtimeClient).toBe(client);
    expect(
      Function(
        "bindings",
        "const { signer, client } = bindings; return client.addressPrefix;",
      )(bindings),
    ).toBe("ckt");
  });
  it("throws a typed friendly error only when signer is actually accessed", () => {
    const { signer } = createWalletBindings(client, undefined);
    expect(() => signer.getRecommendedAddress()).toThrow(MissingWalletError);
    expect(() => signer.client).toThrow(MissingWalletError);
    expect(() => signer.signTransaction({})).toThrow(MissingWalletError);
    expect(() => signer.sendTransaction({})).toThrow(MissingWalletError);
  });
  it("keeps the exported client bound to the signer during network refresh", () => {
    const nextClient = { addressPrefix: "ckb" } as ccc.Client;
    const signer = { client } as ccc.Signer;
    const bindings = createWalletBindings(nextClient, signer);
    expect(bindings.client).toBe(client);
    expect(bindings.client).toBe(bindings.signer.client);
    expect(createWalletBindings(nextClient, undefined).client).toBe(nextClient);
  });
  it("returns the connected signer unchanged, including its method receiver", async () => {
    const signer = {
      client,
      async getRecommendedAddress(this: { client: ccc.Client }) {
        return this.client.addressPrefix;
      },
    } as unknown as ccc.Signer;
    const bindings = createWalletBindings(client, signer);
    expect(bindings.signer).toBe(signer);
    expect(await bindings.signer.getRecommendedAddress()).toBe("ckt");
  });
});

describe("connect wallet action", () => {
  it("only opens the picker; an opened or cancelled picker does not mean connected", async () => {
    const open = vi.fn(() => undefined);
    expect(await requestWalletConnection(open)).toEqual({ opened: true });
    expect(open).toHaveBeenCalledOnce();
    // The action has no execute/sign/send callback and does not retry the script.
    expect(await requestWalletConnection(() => false)).toEqual({
      opened: true,
    });
  });
  it("catches synchronous opening failure and asynchronous rejection", async () => {
    for (const open of [
      () => {
        throw new Error("unavailable");
      },
      () => Promise.reject(new Error("cancelled")),
    ]) {
      const result = await requestWalletConnection(open);
      expect(result.opened).toBe(false);
      if (!result.opened) {
        expect(result.message).toContain("You can try again");
      }
    }
  });
  it("does not confuse arbitrary wallet-looking messages with the typed error", () => {
    expect(
      new Error("This code needs your wallet") instanceof MissingWalletError,
    ).toBe(false);
  });
});
