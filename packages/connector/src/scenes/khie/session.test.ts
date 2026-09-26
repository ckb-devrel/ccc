import { ccc } from "@ckb-ccc/ccc";
import type { PeerId } from "@libp2p/interface";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { KhieNode } from "./node.js";
import { KhiePairingSession } from "./session.js";

const connection = vi.hoisted(() => ({
  start: vi.fn(),
  stop: vi.fn(),
}));

vi.mock("./connection.js", () => ({
  KhieConnectionController: class {
    constructor() {
      connection.start();
    }

    stop() {
      connection.stop();
    }
  },
}));

function createSession() {
  const peerId = {
    equals: (other: PeerId) => other.toString() === "peer",
    toString: () => "peer",
  } as PeerId;
  const pairing = {
    onUnpaired: vi.fn(() => vi.fn()),
    unpair: vi.fn().mockResolvedValue(undefined),
  };
  const node = Object.assign(new EventTarget(), {
    services: { pairing },
  }) as unknown as KhieNode;
  const stopNode = vi.fn();
  const nodeOwner = new ccc.OwnerUnique(node, stopNode);
  const onConnected = vi.fn();
  const session = new KhiePairingSession({
    client: {} as ccc.Client,
    onConnected,
    onStateChange: vi.fn(),
  });
  Object.assign(session, {
    resources: {
      abortController: new AbortController(),
      nodeOwner,
      nodeSubscriptions: [],
    },
  });
  const acceptPeer = () =>
    (
      session as unknown as { acceptPeer(peerId: PeerId): Promise<void> }
    ).acceptPeer(peerId);

  return { acceptPeer, onConnected, pairing, peerId, session, stopNode };
}

describe("KhiePairingSession peer connection lifecycle", () => {
  beforeEach(() => {
    connection.start.mockClear();
    connection.stop.mockClear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("starts before get_info completes and stops when it fails", async () => {
    const { acceptPeer, pairing, peerId, session } = createSession();
    let rejectInfo!: (cause: Error) => void;
    vi.spyOn(ccc.SignerJsonRpc, "new").mockReturnValue(
      new Promise((_, reject) => {
        rejectInfo = reject;
      }),
    );

    const accepting = acceptPeer();
    expect(connection.start).toHaveBeenCalledOnce();
    expect(connection.stop).not.toHaveBeenCalled();

    rejectInfo(new Error("get_info failed"));
    await accepting;
    expect(connection.stop).toHaveBeenCalledOnce();
    expect(pairing.unpair).toHaveBeenCalledWith(peerId);
    await session.close();
  });

  it("keeps the connection controller after connect fails", async () => {
    const { acceptPeer, session } = createSession();
    vi.spyOn(ccc.SignerJsonRpc, "new").mockResolvedValue({
      connect: vi.fn().mockRejectedValue(new Error("connect failed")),
    } as unknown as ccc.SignerJsonRpc);

    await acceptPeer();
    expect(connection.start).toHaveBeenCalledOnce();
    expect(connection.stop).not.toHaveBeenCalled();

    await session.close();
    expect(connection.stop).toHaveBeenCalledOnce();
  });

  it("keeps the same controller until the connected signer is replaced", async () => {
    const { acceptPeer, onConnected, pairing, session, stopNode } =
      createSession();
    let onReplaced!: () => void;
    vi.spyOn(ccc.SignerJsonRpc, "new").mockResolvedValue({
      connect: vi.fn().mockResolvedValue(undefined),
      isConnected: vi.fn().mockResolvedValue(true),
      onReplaced: vi.fn((listener: () => void) => {
        onReplaced = listener;
      }),
      disconnect: vi.fn().mockResolvedValue(undefined),
      name: "Test signer",
      icon: undefined,
    } as unknown as ccc.SignerJsonRpc);

    await acceptPeer();
    expect(connection.start).toHaveBeenCalledOnce();
    expect(connection.stop).not.toHaveBeenCalled();
    expect(onConnected).toHaveBeenCalledOnce();

    await session.close();
    expect(connection.stop).not.toHaveBeenCalled();
    onReplaced();
    await vi.waitFor(() => expect(stopNode).toHaveBeenCalledOnce());
    expect(connection.stop).toHaveBeenCalledOnce();
    expect(pairing.unpair).toHaveBeenCalledOnce();
  });
});
