import { ccc } from "@ckb-ccc/core";
import { describe, expect, it, vi } from "vitest";
import { Connection, ConnectionsRepo } from "./connectionsStorage/index.js";
import { Provider } from "./nip07.advanced.js";
import { NostrAccountChangedError, Signer } from "./signer.js";

const PUBLIC_KEY_A = "11".repeat(32);
const PUBLIC_KEY_B = "22".repeat(32);
const CLIENT = ccc.ClientPublicTestnet.new({
  transport: {
    request: async () => {
      throw new Error("Unexpected request");
    },
  },
});

class ConnectionsRepoMemory implements ConnectionsRepo {
  constructor(public connection?: Connection) {}

  async get(): Promise<Connection | undefined> {
    return this.connection;
  }

  async set(connection: Connection | undefined): Promise<void> {
    this.connection = connection;
  }
}

function createProvider(publicKey = PUBLIC_KEY_A) {
  const getPublicKey = vi.fn(async (): Promise<string> => publicKey);
  const signEvent = vi.fn(
    async (event: ccc.NostrEvent): Promise<Required<ccc.NostrEvent>> => ({
      created_at: event.created_at,
      kind: event.kind,
      tags: event.tags,
      content: event.content,
      id: "event-id",
      pubkey: publicKey,
      sig: "signature",
    }),
  );
  const provider: Provider = {
    getPublicKey,
    signEvent,
  };

  return { getPublicKey, provider, signEvent };
}

function createEvent(): ccc.NostrEvent {
  return {
    created_at: 1,
    kind: 1,
    tags: [],
    content: "test",
  };
}

describe("NIP-07 Signer connection persistence", () => {
  it("refreshes the persisted connection on every connect", async () => {
    const { getPublicKey, provider } = createProvider();
    const repo = new ConnectionsRepoMemory();
    const signer = new Signer(CLIENT, provider, repo);

    await signer.connect();
    getPublicKey.mockResolvedValueOnce(PUBLIC_KEY_B);
    await signer.connect();

    expect(getPublicKey).toHaveBeenCalledTimes(2);
    expect(repo.connection).toEqual({ publicKey: `0x${PUBLIC_KEY_B}` });
  });

  it("restores the persisted connection in a recreated signer", async () => {
    const { getPublicKey, provider } = createProvider();
    const repo = new ConnectionsRepoMemory();
    const signerA = new Signer(CLIENT, provider, repo);

    await signerA.connect();

    const signerB = new Signer(CLIENT, provider, repo);

    expect(await signerB.isConnected()).toBe(true);
    expect(getPublicKey).toHaveBeenCalledTimes(1);
    expect(await signerB.getNostrPublicKey()).toBe(`0x${PUBLIC_KEY_A}`);
    expect(repo.connection).toEqual({ publicKey: `0x${PUBLIC_KEY_A}` });
  });

  it("restores a connection for a new provider without requesting its public key", async () => {
    const repo = new ConnectionsRepoMemory({
      publicKey: `0x${PUBLIC_KEY_A}`,
    });
    const { getPublicKey, provider } = createProvider();
    const signer = new Signer(CLIENT, provider, repo);

    expect(await signer.isConnected()).toBe(true);
    expect(await signer.getNostrPublicKey()).toBe(`0x${PUBLIC_KEY_A}`);
    expect(getPublicKey).not.toHaveBeenCalled();
  });

  it("removes the persisted connection on disconnect", async () => {
    const repo = new ConnectionsRepoMemory();
    const { provider } = createProvider();
    const signer = new Signer(CLIENT, provider, repo);

    await signer.connect();
    await signer.disconnect();

    expect(repo.connection).toBeUndefined();
    expect(await signer.isConnected()).toBe(false);
  });

  it("does not persist a rejected connection and allows retrying", async () => {
    const repo = new ConnectionsRepoMemory();
    const { getPublicKey, provider } = createProvider();
    getPublicKey
      .mockRejectedValueOnce(new Error("Rejected"))
      .mockResolvedValueOnce(PUBLIC_KEY_A);
    const signer = new Signer(CLIENT, provider, repo);

    await expect(signer.connect()).rejects.toThrow("Rejected");
    expect(repo.connection).toBeUndefined();

    await signer.connect();
    expect(getPublicKey).toHaveBeenCalledTimes(2);
    expect(repo.connection).toEqual({ publicKey: `0x${PUBLIC_KEY_A}` });
  });

  it("clears a restored connection when reconnecting is rejected", async () => {
    const repo = new ConnectionsRepoMemory({
      publicKey: `0x${PUBLIC_KEY_A}`,
    });
    const { getPublicKey, provider } = createProvider();
    getPublicKey.mockRejectedValueOnce(new Error("Rejected"));
    const signer = new Signer(CLIENT, provider, repo);

    expect(await signer.isConnected()).toBe(true);
    await expect(signer.connect()).rejects.toThrow("Rejected");

    expect(repo.connection).toBeUndefined();
    expect(await signer.isConnected()).toBe(false);
  });

  it("passes the restored public key to signEvent", async () => {
    const repo = new ConnectionsRepoMemory({
      publicKey: `0x${PUBLIC_KEY_A}`,
    });
    const { provider, signEvent } = createProvider();
    const signer = new Signer(CLIENT, provider, repo);

    await signer.signNostrEvent(createEvent());

    expect(signEvent).toHaveBeenCalledWith({
      ...createEvent(),
      pubkey: PUBLIC_KEY_A,
    });
  });

  it("clears the connection when the wallet signs with another account", async () => {
    const repo = new ConnectionsRepoMemory({
      publicKey: `0x${PUBLIC_KEY_A}`,
    });
    const { provider } = createProvider(PUBLIC_KEY_B);
    const signer = new Signer(CLIENT, provider, repo);

    await expect(signer.signNostrEvent(createEvent())).rejects.toBeInstanceOf(
      NostrAccountChangedError,
    );
    expect(repo.connection).toBeUndefined();
    expect(await signer.isConnected()).toBe(false);
  });
});
