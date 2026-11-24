import { ccc } from "@ckb-ccc/ccc";
import { describe, expect, it, vi } from "vitest";
import {
  EXAMPLE_PUBLIC_KEY,
  ExampleWallet,
  ExampleWalletReadOnlyError,
} from "../src/app/exampleWallet";
import { execute } from "../src/app/execute";
import {
  createWalletBindings,
  MissingWalletError,
} from "../src/app/execute/wallet";
import {
  captureOutputEntry,
  SignerOutputSnapshot,
  snapshotOutput,
} from "../src/app/output";

function mockClient(prefix: string) {
  return {
    addressPrefix: prefix,
    getKnownScript: vi.fn(async () => ({
      codeHash: "0x" + "01".repeat(32),
      hashType: "type",
      cellDeps: [],
    })),
    sendTransaction: vi.fn(),
  } as unknown as ccc.Client;
}

describe("explicit read-only example wallet", () => {
  it("keeps the original public identity without creating a signing key", async () => {
    const client = mockClient("ckt");
    const signer = new ExampleWallet(client);
    expect(signer.publicKey).toBe(EXAMPLE_PUBLIC_KEY);
    expect(signer).toBeInstanceOf(ccc.SignerCkbPublicKey);
    expect((await signer.getRecommendedAddressObj()).prefix).toBe("ckt");
    expect(client.sendTransaction).not.toHaveBeenCalled();
  });

  it("rejects signing and sending before transaction preparation or RPC", async () => {
    const client = mockClient("ckt");
    const signer = new ExampleWallet(client);
    const prepare = vi.spyOn(signer, "prepareTransaction");
    for (const operation of [
      () => signer.signMessage("demo"),
      () => signer.signMessageRaw("demo"),
      () => signer.signTransaction({}),
      () => signer.signOnlyTransaction({}),
      () => signer.sendTransaction({}),
    ]) {
      await expect(operation()).rejects.toBeInstanceOf(
        ExampleWalletReadOnlyError,
      );
    }
    expect(prepare).not.toHaveBeenCalled();
    expect(client.getKnownScript).not.toHaveBeenCalled();
    expect(client.sendTransaction).not.toHaveBeenCalled();
  });

  it("keeps old output on its captured network after choosing a new example client", async () => {
    const first = new ExampleWallet(mockClient("ckt"));
    const [snapshot] = snapshotOutput([first]) as [SignerOutputSnapshot];
    const second = new ExampleWallet(mockClient("ckb"));
    const result = await snapshot.result;
    expect("address" in result && result.address.prefix).toBe("ckt");
    expect((await second.getRecommendedAddressObj()).prefix).toBe("ckb");
    expect(first.client.addressPrefix).toBe("ckt");
  });

  it("requires an explicit rerun and does not retain the example after disconnect", async () => {
    const client = mockClient("ckt");
    const source = `import { signer } from "@ckb-ccc/playground"; console.log(await signer.getRecommendedAddress());`;
    const log = vi.fn();
    await expect(
      execute(source, async () => {}, undefined, log, client),
    ).rejects.toBeInstanceOf(MissingWalletError);
    const example = new ExampleWallet(client);
    expect(log).not.toHaveBeenCalled();
    expect(client.getKnownScript).not.toHaveBeenCalled();
    await execute(source, async () => {}, example, log, client);
    expect(log).toHaveBeenCalledOnce();
    expect(log.mock.calls[0][2][0]).toMatch(/^ckt/);
    const disconnected = createWalletBindings(client, undefined);
    expect(() => disconnected.signer.getRecommendedAddress()).toThrow(
      MissingWalletError,
    );
    expect(client.sendTransaction).not.toHaveBeenCalled();
  });

  it("captures the example label per entry rather than following wallet switches", () => {
    const testnet = mockClient("ckt");
    const exampleEntry = captureOutputEntry(
      "info",
      "first",
      ["demo"],
      1,
      testnet,
      true,
    );
    const realEntry = captureOutputEntry(
      "info",
      "second",
      ["real"],
      2,
      mockClient("ckb"),
      false,
    );
    expect(exampleEntry[5]).toBe(true);
    expect(exampleEntry[4]).toBe(testnet);
    expect(realEntry[5]).toBe(false);
    expect(exampleEntry[5]).toBe(true);
  });

  it("uses an explicitly supplied real signer unchanged", () => {
    const client = mockClient("ckt");
    const real = {
      client,
      getIdentity: async () => "real-account",
    } as ccc.Signer;
    expect(createWalletBindings(client, real).signer).toBe(real);
  });
});
