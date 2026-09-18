import { ccc } from "@ckb-ccc/ccc";
import { describe, expect, it, vi } from "vitest";
import { ConnectedScene } from "./connected.js";

function promiseWithResolvers<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolveInner, rejectInner) => {
    resolve = resolveInner;
    reject = rejectInner;
  });
  return { promise, reject, resolve };
}

function bindRefreshSignerInfo(scene: ConnectedScene) {
  return (
    ConnectedScene.prototype as unknown as {
      refreshSignerInfo(signer: ccc.Signer | undefined): void;
    }
  ).refreshSignerInfo.bind(scene);
}

describe("ConnectedScene", () => {
  it("publishes both addresses while balance is pending", async () => {
    const recommendedAddress = promiseWithResolvers<string>();
    const internalAddress = promiseWithResolvers<string>();
    const balance = promiseWithResolvers<ccc.Num>();
    const signer = {
      getBalance: vi.fn(() => balance.promise),
      getInternalAddress: vi.fn(() => internalAddress.promise),
      getRecommendedAddress: vi.fn(() => recommendedAddress.promise),
    } as unknown as ccc.Signer;
    const scene = {
      balance: 1n,
      internalAddress: "old-internal-address",
      recommendedAddress: "old-recommended-address",
      refreshId: 0,
    } as unknown as ConnectedScene;
    const refreshSignerInfo = bindRefreshSignerInfo(scene);

    refreshSignerInfo(signer);

    expect(scene).toMatchObject({
      balance: undefined,
      internalAddress: undefined,
      recommendedAddress: undefined,
    });

    recommendedAddress.resolve("recommended-address");
    internalAddress.resolve("internal-address");
    await vi.waitFor(() =>
      expect(scene).toMatchObject({
        balance: undefined,
        internalAddress: "internal-address",
        recommendedAddress: "recommended-address",
      }),
    );

    balance.resolve(42n);
    await vi.waitFor(() => expect(scene).toMatchObject({ balance: 42n }));
  });

  it("does not let a stale request overwrite a newer signer", async () => {
    const firstAddress = promiseWithResolvers<string>();
    const secondAddress = promiseWithResolvers<string>();
    const pending = new Promise<never>(() => {});
    const firstSigner = {
      getBalance: vi.fn(() => pending),
      getInternalAddress: vi.fn(() => pending),
      getRecommendedAddress: vi.fn(() => firstAddress.promise),
    } as unknown as ccc.Signer;
    const secondSigner = {
      getBalance: vi.fn(() => pending),
      getInternalAddress: vi.fn(() => pending),
      getRecommendedAddress: vi.fn(() => secondAddress.promise),
    } as unknown as ccc.Signer;
    const scene = { refreshId: 0 } as unknown as ConnectedScene;
    const refreshSignerInfo = bindRefreshSignerInfo(scene);

    refreshSignerInfo(firstSigner);
    refreshSignerInfo(secondSigner);
    secondAddress.resolve("new-address");
    await vi.waitFor(() =>
      expect(scene).toMatchObject({ recommendedAddress: "new-address" }),
    );

    firstAddress.resolve("stale-address");
    await Promise.resolve();
    await Promise.resolve();

    expect(scene).toMatchObject({ recommendedAddress: "new-address" });
  });
});
