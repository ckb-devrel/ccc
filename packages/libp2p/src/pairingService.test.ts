import type { Connection, PeerId, StreamHandler } from "@libp2p/interface";
import { streamPair } from "@libp2p/utils";
import { describe, expect, it, vi, type Mock } from "vitest";
import {
  pairingService,
  type PairingService,
  type PairingServiceComponents,
} from "./pairingService.js";

const PROTOCOL = "/pairing/test/1.0.0";
type OpenStream = PairingServiceComponents["connectionManager"]["openStream"];

type TestNode = {
  components: PairingServiceComponents;
  handler?: StreamHandler;
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

function createTestNode(id: string): TestNode {
  const node = {} as TestNode;
  const openStream = vi.fn<OpenStream>();
  const components = {
    connectionManager: {
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
