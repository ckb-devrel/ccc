import { ccc } from "@ckb-ccc/ccc";
import { PropertyValues } from "lit";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ConnectorConnection,
  ConnectorConnectionEvent,
} from "../events/external.js";
import { ClientWithFeeRate } from "./client.js";
import { WebComponentConnector } from "./index.js";

function createSigner(client: ccc.Client) {
  let connected = true;
  const replacedListeners = new Set<() => void>();
  const close = vi.fn();
  const replace = () => {
    if (!connected) return;
    connected = false;
    const listeners = [...replacedListeners];
    replacedListeners.clear();
    listeners.forEach((listener) => listener());
  };
  const disconnect = vi.fn(async () => {
    if (!connected) return;
    close();
    replace();
  });
  const signer = {
    client,
    disconnect,
    icon: undefined,
    isConnected: vi.fn(async () => connected),
    name: "Khie",
    onReplaced(listener: () => void) {
      replacedListeners.add(listener);
      return () => replacedListeners.delete(listener);
    },
  } as unknown as ccc.SignerJsonRpc;

  return { close, disconnect, replace, signer };
}

function connectKhie(
  connector: WebComponentConnector,
  signer: ccc.SignerJsonRpc,
) {
  let connectionOwner: ccc.Owner<ConnectorConnection> | undefined;
  connector.addEventListener(
    ConnectorConnectionEvent.eventName,
    (event: Event) => {
      const connectedEvent = event as ConnectorConnectionEvent;
      connectedEvent.stopPropagation();
      if (
        connectedEvent.connectionOwner &&
        !connectedEvent.connectionOwner.isValid
      ) {
        return;
      }
      const owner = connectedEvent.connectionOwner?.map(
        (connection) => connection,
      );
      const previous = connectionOwner;
      connectionOwner = owner;
      void previous?.dispose();
      if (!owner) {
        return;
      }
      owner.value.signerInfo.signer.onReplaced(() => {
        void owner.dispose();
      });
    },
  );

  const wallet = { icon: "", name: "Khie" };
  const signerInfo = new ccc.SignerInfo(wallet.name, signer);
  const sourceOwner = new ccc.OwnerUnique(
    { signerInfo, wallet },
    ({ signerInfo }) => signerInfo.signer.disconnect(),
  );
  const event = new ConnectorConnectionEvent(sourceOwner);
  (
    connector as unknown as { handleKhieConnected(): void }
  ).handleKhieConnected();

  expect(event.cancelBubble).toBe(false);
  expect(sourceOwner.value).toEqual({ signerInfo, wallet });
  connector.dispatchEvent(event);

  expect(event.cancelBubble).toBe(true);
  expect(() => sourceOwner.value).toThrow(/moved or disposed/i);
  expect(connectionOwner).toBeDefined();
  return connectionOwner!;
}

function signersControllerFrom(connector: WebComponentConnector) {
  return (
    connector as unknown as {
      signersControllerInner: {
        wallets: ccc.WalletWithSigners[];
        refresh(): Promise<void>;
      };
    }
  ).signersControllerInner;
}

describe("WebComponentConnector connection lifecycle", () => {
  afterEach(() => vi.unstubAllGlobals());

  function createConnector() {
    vi.stubGlobal("window", {
      localStorage: {
        getItem: vi.fn(() => null),
        setItem: vi.fn(),
      },
    });
    return new WebComponentConnector();
  }

  it("forwards ownership while retaining borrowed connection state", async () => {
    const connector = createConnector();
    const client = new ccc.ClientPublicTestnet();
    const { close, signer } = createSigner(client);
    const connected = vi.fn();
    const cleared = vi.fn();
    connector.client = client;
    connector.addEventListener(
      ConnectorConnectionEvent.eventName,
      (event: Event) => {
        if ((event as ConnectorConnectionEvent).connectionOwner) {
          connected();
        } else {
          cleared();
        }
      },
    );

    const connectionOwner = connectKhie(connector, signer);
    expect(connected).toHaveBeenCalledOnce();
    expect(connector.signer?.signer).toBe(signer);
    expect(
      (
        connector as unknown as {
          connection?: ConnectorConnection;
        }
      ).connection?.signerInfo.signer,
    ).toBe(signer);

    await connectionOwner.dispose();
    expect(close).toHaveBeenCalledOnce();
    expect(cleared).toHaveBeenCalledOnce();
    expect(connector.signer).toBeUndefined();
    expect(
      (
        connector as unknown as {
          connection?: ConnectorConnection;
        }
      ).connection,
    ).toBeUndefined();
  });

  it("uses the document title when the application name is not configured", () => {
    vi.stubGlobal("document", {
      querySelector: vi.fn((selector: string) =>
        selector === "head title" ? { text: "Page title" } : null,
      ),
    });
    const connector = createConnector();

    expect((connector as unknown as { appName: string }).appName).toBe(
      "Page title",
    );

    connector.name = "Configured name";
    expect((connector as unknown as { appName: string }).appName).toBe(
      "Configured name",
    );
  });

  it("does not disconnect a controller signer when its owner is disposed", async () => {
    const connector = createConnector();
    const client = new ccc.ClientPublicTestnet();
    const { close, signer } = createSigner(client);
    const wallet = { icon: "", name: "Wallet" };
    const signerInfo = new ccc.SignerInfo("Signer", signer);
    const walletWithSigners = { ...wallet, signers: [signerInfo] };
    let connectionOwner: ccc.Owner<ConnectorConnection> | undefined;
    const connected = vi.fn();
    connector.client = client;
    connector.addEventListener(
      ConnectorConnectionEvent.eventName,
      (event: Event) => {
        const eventOwner = (event as ConnectorConnectionEvent).connectionOwner;
        if (eventOwner) {
          connected();
          connectionOwner = eventOwner.map((connection) => connection);
        }
      },
    );

    (
      connector as unknown as {
        signerName?: string;
        walletName?: string;
      }
    ).walletName = wallet.name;
    (
      connector as unknown as {
        signerName?: string;
        walletName?: string;
      }
    ).signerName = signerInfo.name;
    signersControllerFrom(connector).wallets = [walletWithSigners];
    connector.refreshSigner();
    await vi.waitFor(() => expect(connectionOwner).toBeDefined());

    expect(connectionOwner?.value).toEqual({
      signerInfo,
      wallet: walletWithSigners,
    });
    expect(connected).toHaveBeenCalledOnce();
    signersControllerFrom(connector).refresh = () => Promise.resolve();
    await connectionOwner?.dispose();
    expect(close).not.toHaveBeenCalled();
  });

  it("replaces a selected connection without an intermediate clear", async () => {
    const connector = createConnector();
    const client = new ccc.ClientPublicTestnet();
    const previous = createSigner(client);
    const next = createSigner(client);
    const transitions: Array<ccc.Signer | undefined> = [];
    connector.client = client;
    connector.addEventListener(
      ConnectorConnectionEvent.eventName,
      (event: Event) => {
        transitions.push(
          (event as ConnectorConnectionEvent).connectionOwner?.value.signerInfo
            .signer,
        );
      },
    );
    connectKhie(connector, previous.signer);

    const wallet = { icon: "", name: "Wallet" };
    const signerInfo = new ccc.SignerInfo("Signer", next.signer);
    signersControllerFrom(connector).wallets = [
      { ...wallet, signers: [signerInfo] },
    ];
    (
      connector as unknown as {
        handleConnected(connection: {
          signerName: string;
          walletName: string;
        }): void;
      }
    ).handleConnected({
      signerName: signerInfo.name,
      walletName: wallet.name,
    });

    await vi.waitFor(() => expect(connector.signer?.signer).toBe(next.signer));
    await vi.waitFor(() => expect(previous.disconnect).toHaveBeenCalledOnce());
    expect(transitions).toEqual([previous.signer, next.signer]);

    connector.disconnect();
    await vi.waitFor(() => expect(next.disconnect).toHaveBeenCalledOnce());
  });

  it("clears signer state when the signer is replaced", async () => {
    const connector = createConnector();
    const client = new ccc.ClientPublicTestnet();
    const { replace, signer } = createSigner(client);
    connector.client = client;
    const connectionOwner = connectKhie(connector, signer);

    replace();
    await vi.waitFor(() =>
      expect(() => connectionOwner.value).toThrow(/moved or disposed/i),
    );

    expect(connector.signer).toBeUndefined();
  });

  it("ignores a connection event whose ownership is no longer active", async () => {
    const connector = createConnector();
    const client = new ccc.ClientPublicTestnet();
    const current = createSigner(client);
    const stale = createSigner(client);
    connector.client = client;
    const currentOwner = connectKhie(connector, current.signer);
    const wallet = { icon: "", name: "Khie" };
    const staleOwner = new ccc.OwnerUnique(
      {
        signerInfo: new ccc.SignerInfo(wallet.name, stale.signer),
        wallet,
      },
      ({ signerInfo }) => signerInfo.signer.disconnect(),
    );
    await staleOwner.dispose();

    connector.dispatchEvent(new ConnectorConnectionEvent(staleOwner));

    expect(connector.signer?.signer).toBe(current.signer);
    await currentOwner.dispose();
  });

  it("runs a delayed transition after cleaning up its scene", () => {
    vi.useFakeTimers();
    try {
      const connector = createConnector();
      const order: string[] = [];
      connector.addEventListener("close", () => order.push("close"));
      (connector as unknown as { backToHome(): void }).backToHome = () =>
        order.push("cleanup");

      connector.close(() => order.push("transition"));
      expect(order).toEqual([]);
      vi.advanceTimersByTime(150);

      expect(order).toEqual(["close", "cleanup", "transition"]);
    } finally {
      vi.useRealTimers();
    }
  });

  it("disconnects the Khie signer when the Client changes", async () => {
    const connector = createConnector();
    const firstClient = ClientWithFeeRate.from(new ccc.ClientPublicTestnet());
    const secondClient = ClientWithFeeRate.from(new ccc.ClientPublicMainnet());
    const { close, disconnect, signer } = createSigner(firstClient);
    connector.client = firstClient;
    connectKhie(connector, signer);
    signersControllerFrom(connector).refresh = () => Promise.resolve();

    connector.client = secondClient;
    connector.willUpdate(new Map([["client", firstClient]]) as PropertyValues);
    await vi.waitFor(() => expect(close).toHaveBeenCalledOnce());

    expect(disconnect).toHaveBeenCalled();
    expect(connector.signer).toBeUndefined();
  });

  it("keeps a controller signer until refresh replaces it", async () => {
    const connector = createConnector();
    const firstClient = ClientWithFeeRate.from(new ccc.ClientPublicTestnet());
    const secondClient = ClientWithFeeRate.from(new ccc.ClientPublicMainnet());
    const { close, signer } = createSigner(firstClient);
    const wallet = { icon: "", name: "Wallet" };
    const signerInfo = new ccc.SignerInfo("Signer", signer);
    const refresh = vi.fn(() => Promise.resolve());
    connector.client = firstClient;
    (
      connector as unknown as {
        signerName?: string;
        walletName?: string;
      }
    ).walletName = wallet.name;
    (
      connector as unknown as {
        signerName?: string;
        walletName?: string;
      }
    ).signerName = signerInfo.name;
    signersControllerFrom(connector).refresh = refresh;

    const controller = signersControllerFrom(connector);
    controller.wallets = [{ ...wallet, signers: [signerInfo] }];
    connector.refreshSigner();
    await vi.waitFor(() => expect(connector.signer?.signer).toBe(signer));

    connector.client = secondClient;
    connector.willUpdate(new Map([["client", firstClient]]) as PropertyValues);

    expect(close).not.toHaveBeenCalled();
    expect(connector.signer?.signer).toBe(signer);
    expect(refresh).toHaveBeenCalledOnce();
  });
});
