import { ccc } from "@ckb-ccc/core";
import { multiaddr, type Multiaddr } from "@multiformats/multiaddr";
import * as lp from "it-length-prefixed";
import { describe, expect, it } from "vitest";
import {
  decodePairingEndpoint,
  encodePairingEndpoint,
  PairingEndpointRoleError,
} from "./pairingEndpoint.js";

const addresses = [
  multiaddr(
    "/dns4/relay.ckbccc.com/tcp/443/wss/p2p/12D3KooWQwLwBK3EaCaJQNL9KBUvPi9Vh3gZqPfLQVi7aZpHkF3S/p2p-circuit/webrtc/p2p/12D3KooWJZQ7ypYJ6LHVYbNcKZX7HxV5pnPHJHvJ7zH2Bf6WmDKm",
  ),
  multiaddr(
    "/dns4/relay.ckbccc.com/tcp/443/wss/p2p/12D3KooWQwLwBK3EaCaJQNL9KBUvPi9Vh3gZqPfLQVi7aZpHkF3S/p2p-circuit/p2p/12D3KooWJZQ7ypYJ6LHVYbNcKZX7HxV5pnPHJHvJ7zH2Bf6WmDKm",
  ),
];

async function compress(bytes: Uint8Array) {
  const stream = new CompressionStream("deflate");
  const output = new Response(stream.readable).arrayBuffer();
  const writer = stream.writable.getWriter();
  await writer.write(Uint8Array.from(bytes));
  await writer.close();
  return new Uint8Array(await output);
}

function endpointFromCompressedAddresses(bytes: Uint8Array) {
  const url = new URL("https://app.ckbccc.com/#signer");
  const params = new URLSearchParams({
    addresses: ccc.bytesTo(bytes, "base64url"),
    secret: "pairing-secret",
  });
  url.hash = `signer?${params.toString()}`;
  return url.toString();
}

function fragmentParams(url: URL) {
  const separator = url.hash.indexOf("?");
  return {
    params: new URLSearchParams(url.hash.slice(separator + 1)),
    route: url.hash.slice(1, separator),
  };
}

describe("pairing endpoint", () => {
  it("encodes pairing parameters in the URL fragment", async () => {
    const endpoint = await encodePairingEndpoint(
      "https://app.ckbccc.com/?theme=dark&secret=old#signer?source=qr",
      addresses,
      "pairing-secret",
      "provider",
    );
    const url = new URL(endpoint);
    const { params, route } = fragmentParams(url);

    expect(url.searchParams.toString()).toBe("theme=dark&secret=old");
    expect(route).toBe("signer");
    expect(params.get("source")).toBe("qr");
    expect(params.get("role")).toBe("provider");
    expect(params.get("addresses")).toMatch(/^[\w-]+$/);
    expect(params.get("secret")).toBe("pairing-secret");
    expect(params.has("addr")).toBe(false);
    await expect(
      decodePairingEndpoint(endpoint, "provider"),
    ).resolves.toMatchObject({
      addresses,
      secret: "pairing-secret",
    });
  });

  it("rejects an unexpected or missing endpoint role", async () => {
    const endpoint = await encodePairingEndpoint(
      "https://app.ckbccc.com/#signer",
      addresses,
      "pairing-secret",
      "provider",
    );

    await expect(
      decodePairingEndpoint(endpoint, "connector"),
    ).rejects.toBeInstanceOf(PairingEndpointRoleError);

    const url = new URL(endpoint);
    const { params, route } = fragmentParams(url);
    params.delete("role");
    url.hash = `${route}?${params.toString()}`;
    await expect(
      decodePairingEndpoint(url.toString(), "provider"),
    ).rejects.toMatchObject({
      actualRole: undefined,
      expectedRole: "provider",
    });
  });

  it("rejects pairing parameters outside the fragment", async () => {
    const url = new URL("https://app.ckbccc.com/#signer");
    url.searchParams.set("addresses", "ignored");
    url.searchParams.set("secret", "pairing-secret");

    await expect(decodePairingEndpoint(url.toString())).rejects.toThrow(
      "Pairing endpoint is incomplete",
    );
  });

  it("rejects invalid compressed addresses", async () => {
    await expect(
      decodePairingEndpoint(
        "https://app.ckbccc.com/#signer?addresses=invalid&secret=pairing-secret",
      ),
    ).rejects.toThrow("Pairing endpoint contains invalid compressed addresses");
  });

  it("stops decompression after the output limit", async () => {
    const compressed = await compress(new Uint8Array(16 * 1024 + 1));

    await expect(
      decodePairingEndpoint(endpointFromCompressedAddresses(compressed)),
    ).rejects.toMatchObject({
      cause: { message: "Decompressed address data is too large" },
    });
  });

  it("limits the number of addresses", async () => {
    const tooManyAddresses = Array.from({ length: 17 }, () => addresses[0]);
    await expect(
      encodePairingEndpoint(
        "https://app.ckbccc.com/#signer",
        tooManyAddresses,
        "pairing-secret",
      ),
    ).rejects.toThrow("Pairing endpoint supports at most 16 addresses");

    const encoded = encodeAddressesForTest(tooManyAddresses);
    const compressed = await compress(encoded);
    await expect(
      decodePairingEndpoint(endpointFromCompressedAddresses(compressed)),
    ).rejects.toMatchObject({ cause: { message: "Too many addresses" } });
  });
});

function encodeAddressesForTest(addresses: readonly Multiaddr[]) {
  return ccc.bytesConcat(
    ...lp.encode(addresses.map((address) => address.bytes)),
  );
}
