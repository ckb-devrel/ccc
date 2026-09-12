import type { Connection, PeerId, StreamHandler } from "@libp2p/interface";
import { streamPair } from "@libp2p/utils";
import { multiaddr, type Multiaddr } from "@multiformats/multiaddr";
import { describe, expect, it, vi, type Mock } from "vitest";
import {
  pairingService,
  type PairingService,
  type PairingServiceComponents,
} from "./pairingService.js";

const PROTOCOL = "/pairing/test/1.0.0";
type OpenStream = PairingServiceComponents["connectionManager"]["openStream"];
type OpenConnection =
  PairingServiceComponents["connectionManager"]["openConnection"];
type GetConnections =
  PairingServiceComponents["connectionManager"]["getConnections"];

type TestNode = {
  components: PairingServiceComponents;
  handler?: StreamHandler;
  getConnections: Mock<GetConnections>;
  openConnection: Mock<OpenConnection>;
  openStream: Mock<OpenStream>;
  peerId: PeerId;
  service: PairingService;
};

function testPeerId(value: string): PeerId {
  return {
    equals: (other: PeerId) => other.toString() === value,
    toString: () => value,
  } as PeerId;
}

function createTestNode(id: string, addresses: Multiaddr[] = []): TestNode {
  const node = {} as TestNode;
  const openConnection = vi.fn<OpenConnection>();
  const openStream = vi.fn<OpenStream>();
  const getConnections = vi.fn<GetConnections>(() => []);
  const components = {
    addressManager: {
      getAddresses: () => addresses,
    },
    connectionManager: {
      getConnections,
      openConnection,
      openStream,
    },
    registrar: {
      handle: vi.fn(async (_protocol: string, handler: StreamHandler) => {
        node.handler = handler;
      }),
      unhandle: vi.fn(async () => {}),
    },
  } as unknown as PairingServiceComponents;

  node.components = components;
  node.getConnections = getConnections;
  node.openConnection = openConnection;
  node.openStream = openStream;
  node.peerId = testPeerId(id);
  node.service = pairingService(
    { pairedPeerTimeoutMs: 60_000, protocol: PROTOCOL },
    () => true,
  )(components);
  return node;
}

function connect(source: TestNode, target: TestNode) {
  source.openStream.mockImplementation(async (_target, _protocol, options) => {
    const [outbound, inbound] = await streamPair({ protocol: PROTOCOL });
    const outgoingConnection = {
      remotePeer: target.peerId,
    } as Connection;
    const incomingConnection = {
      remotePeer: source.peerId,
    } as Connection;
    options?.onProgress?.({
      detail: { connection: outgoingConnection, stream: outbound },
      type: "connection:opened-stream",
    });
    void target.handler?.(inbound, incomingConnection);
    return outbound;
  });
}

describe("PairingService secret rotation", () => {
  it("rotates both peers after pairing and rejects the consumed secret", async () => {
    const initiator = createTestNode("initiator");
    const provider = createTestNode("provider");
    const replay = createTestNode("replay");
    await Promise.all([
      initiator.service.start(),
      provider.service.start(),
      replay.service.start(),
    ]);
    connect(initiator, provider);
    connect(replay, provider);

    const initiatorSecret = initiator.service.secret;
    const providerSecret = provider.service.secret;
    const replaySecret = replay.service.secret;
    const initiatorSecrets: string[] = [];
    const providerSecrets: string[] = [];
    initiator.service.onSecretChanged((secret) =>
      initiatorSecrets.push(secret),
    );
    provider.service.onSecretChanged((secret) => providerSecrets.push(secret));

    try {
      await expect(
        initiator.service.pair({ addresses: [], secret: providerSecret }),
      ).resolves.toBe(provider.peerId);

      expect(initiator.service.secret).not.toBe(initiatorSecret);
      expect(provider.service.secret).not.toBe(providerSecret);
      expect(initiatorSecrets).toEqual([initiator.service.secret]);
      expect(providerSecrets).toEqual([provider.service.secret]);

      await expect(
        replay.service.pair({ addresses: [], secret: providerSecret }),
      ).rejects.toThrow("Pairing rejected");
      expect(replay.service.secret).toBe(replaySecret);
      expect(providerSecrets).toEqual([provider.service.secret]);
    } finally {
      await Promise.all([
        initiator.service.stop(),
        provider.service.stop(),
        replay.service.stop(),
      ]);
    }
  });

  it("accepts only one concurrent request with the same secret", async () => {
    const first = createTestNode("first");
    const second = createTestNode("second");
    const provider = createTestNode("provider");
    await Promise.all([
      first.service.start(),
      second.service.start(),
      provider.service.start(),
    ]);
    connect(first, provider);
    connect(second, provider);

    const secret = provider.service.secret;
    try {
      const results = await Promise.allSettled([
        first.service.pair({ addresses: [], secret }),
        second.service.pair({ addresses: [], secret }),
      ]);

      expect(
        results.filter(({ status }) => status === "fulfilled"),
      ).toHaveLength(1);
      expect(
        results.filter(({ status }) => status === "rejected"),
      ).toHaveLength(1);
      expect(provider.service.secret).not.toBe(secret);
    } finally {
      await Promise.all([
        first.service.stop(),
        second.service.stop(),
        provider.service.stop(),
      ]);
    }
  });
});

describe("PairingService address exchange", () => {
  it("opens a fallback connection through the initiator addresses", async () => {
    const initiatorId = "12D3KooWJZQ7ypYJ6LHVYbNcKZX7HxV5pnPHJHvJ7zH2Bf6WmDKm";
    const providerId = "12D3KooWQwLwBK3EaCaJQNL9KBUvPi9Vh3gZqPfLQVi7aZpHkF3S";
    const initiatorAddresses = [
      multiaddr(`/dns4/app.example.com/tcp/443/wss/p2p/${initiatorId}`),
      multiaddr(
        `/dns4/relay.ckbccc.com/tcp/443/wss/p2p/${providerId}/p2p-circuit/p2p/${initiatorId}`,
      ),
    ];
    const ignoredAddresses = [
      multiaddr(`/dns4/app.example.com/tcp/443/wss/p2p/${providerId}`),
      { toString: () => "invalid" } as Multiaddr,
    ];
    const initiator = createTestNode(initiatorId, [
      ...initiatorAddresses,
      ...ignoredAddresses,
    ]);
    const provider = createTestNode(providerId);
    await Promise.all([initiator.service.start(), provider.service.start()]);
    connect(initiator, provider);

    try {
      await initiator.service.pair({
        addresses: [],
        secret: provider.service.secret,
      });

      await vi.waitFor(() => {
        expect(provider.openConnection).toHaveBeenCalledWith(
          initiatorAddresses,
        );
      });
    } finally {
      await Promise.all([initiator.service.stop(), provider.service.stop()]);
    }
  });

  it("limits announced addresses to the pairing message size", async () => {
    const initiatorId = "12D3KooWJZQ7ypYJ6LHVYbNcKZX7HxV5pnPHJHvJ7zH2Bf6WmDKm";
    const providerId = "12D3KooWQwLwBK3EaCaJQNL9KBUvPi9Vh3gZqPfLQVi7aZpHkF3S";
    const initiatorAddresses = Array.from({ length: 16 }, (_, index) =>
      multiaddr(
        `/dns4/relay-${index}.example.com/tcp/${4000 + index}/ws/p2p/${initiatorId}`,
      ),
    );
    const initiator = createTestNode(initiatorId, initiatorAddresses);
    const provider = createTestNode(providerId);
    await Promise.all([initiator.service.start(), provider.service.start()]);
    connect(initiator, provider);

    const secret = provider.service.secret;
    const fullRequest = {
      type: "pair",
      secret,
      addresses: initiatorAddresses.map((address) => address.toString()),
    };
    expect(
      new TextEncoder().encode(JSON.stringify(fullRequest)).byteLength,
    ).toBeGreaterThan(1024);

    try {
      await expect(
        initiator.service.pair({ addresses: [], secret }),
      ).resolves.toBe(provider.peerId);
      await vi.waitFor(() =>
        expect(provider.openConnection).toHaveBeenCalledOnce(),
      );

      const dialTarget = provider.openConnection.mock.calls[0]?.[0];
      expect(Array.isArray(dialTarget)).toBe(true);
      const announcedAddresses = dialTarget as Multiaddr[];
      expect(announcedAddresses.length).toBeGreaterThan(0);
      expect(announcedAddresses.length).toBeLessThan(initiatorAddresses.length);
      expect(
        new TextEncoder().encode(
          JSON.stringify({
            type: "pair",
            secret,
            addresses: announcedAddresses.map((address) => address.toString()),
          }),
        ).byteLength,
      ).toBeLessThanOrEqual(1024);
    } finally {
      await Promise.all([initiator.service.stop(), provider.service.stop()]);
    }
  });
});

describe("PairingService timeout", () => {
  it("keeps a connected peer paired and starts a full timeout when refreshed offline", async () => {
    vi.useFakeTimers();
    const initiator = createTestNode("initiator");
    const provider = createTestNode("provider");
    await Promise.all([initiator.service.start(), provider.service.start()]);
    connect(initiator, provider);

    try {
      await initiator.service.pair({
        addresses: [],
        secret: provider.service.secret,
      });
      initiator.getConnections.mockReturnValue([
        {
          remotePeer: provider.peerId,
          status: "open",
        } as Connection,
      ]);

      await vi.advanceTimersByTimeAsync(60_000);
      expect(initiator.service.isPaired(provider.peerId)).toBe(true);

      initiator.getConnections.mockReturnValue([]);
      initiator.service.refresh(provider.peerId);
      await vi.advanceTimersByTimeAsync(59_999);
      expect(initiator.service.isPaired(provider.peerId)).toBe(true);
      await vi.advanceTimersByTimeAsync(1);
      expect(initiator.service.isPaired(provider.peerId)).toBe(false);
    } finally {
      await Promise.all([initiator.service.stop(), provider.service.stop()]);
      vi.useRealTimers();
    }
  });
});
