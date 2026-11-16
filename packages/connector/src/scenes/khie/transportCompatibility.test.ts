import { noise } from "@chainsafe/libp2p-noise";
import { yamux } from "@chainsafe/libp2p-yamux";
import { circuitRelayTransport } from "@libp2p/circuit-relay-v2";
import { identify, identifyPush } from "@libp2p/identify";
import { webRTC } from "@libp2p/webrtc";
import { webSockets } from "@libp2p/websockets";
import { createLibp2p } from "libp2p";
import { describe, expect, it } from "vitest";

describe("Khie transport dependency compatibility", () => {
  it("constructs the real transport stack without starting network listeners", async () => {
    // Keep this type-checked: mismatched registrar/peer-collection versions must
    // not be hidden with casts. start:false keeps the smoke test offline.
    const node = await createLibp2p({
      start: false,
      transports: [webSockets(), webRTC(), circuitRelayTransport()],
      connectionEncrypters: [noise()],
      streamMuxers: [yamux()],
      services: { identify: identify(), identifyPush: identifyPush() },
    });

    try {
      expect(node.status).toBe("stopped");
      expect(node.getConnections()).toEqual([]);
    } finally {
      await node.stop();
    }
  });
});
