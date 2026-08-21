import { multiaddr } from "@multiformats/multiaddr";
import { describe, expect, it } from "vitest";
import {
  decodePairingEndpoint,
  encodePairingEndpoint,
} from "./pairingEndpoint.js";

const addresses = [
  multiaddr(
    "/dns4/relay.ckbccc.com/tcp/443/wss/p2p/12D3KooWQwLwBK3EaCaJQNL9KBUvPi9Vh3gZqPfLQVi7aZpHkF3S/p2p-circuit/webrtc/p2p/12D3KooWJZQ7ypYJ6LHVYbNcKZX7HxV5pnPHJHvJ7zH2Bf6WmDKm",
  ),
  multiaddr(
    "/dns4/relay.ckbccc.com/tcp/443/wss/p2p/12D3KooWQwLwBK3EaCaJQNL9KBUvPi9Vh3gZqPfLQVi7aZpHkF3S/p2p-circuit/p2p/12D3KooWJZQ7ypYJ6LHVYbNcKZX7HxV5pnPHJHvJ7zH2Bf6WmDKm",
  ),
];

describe("pairing endpoint", () => {
  it("deflate-compresses addresses into one URL parameter", async () => {
    const endpoint = await encodePairingEndpoint(
      "https://app.ckbccc.com/#signer",
      addresses,
      "pairing-secret",
    );
    const url = new URL(endpoint);

    expect(url.searchParams.get("addresses")).toMatch(/^[\w-]+$/);
    expect(url.searchParams.has("addr")).toBe(false);
    await expect(decodePairingEndpoint(endpoint)).resolves.toMatchObject({
      addresses,
      secret: "pairing-secret",
    });
  });

  it("rejects legacy repeated addr parameters", async () => {
    const url = new URL("https://app.ckbccc.com/#signer");
    addresses.forEach((address) =>
      url.searchParams.append("addr", address.toString()),
    );
    url.searchParams.set("secret", "pairing-secret");

    await expect(decodePairingEndpoint(url.toString())).rejects.toThrow(
      "Pairing endpoint is incomplete",
    );
  });

  it("rejects invalid compressed addresses", async () => {
    await expect(
      decodePairingEndpoint(
        "https://app.ckbccc.com/?addresses=invalid&secret=pairing-secret#signer",
      ),
    ).rejects.toThrow("Pairing endpoint contains invalid compressed addresses");
  });
});
