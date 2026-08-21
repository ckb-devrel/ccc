import { ccc } from "@ckb-ccc/core";
import { multiaddr, type Multiaddr } from "@multiformats/multiaddr";
import * as lp from "it-length-prefixed";
import type { PairingTarget } from "./pairingService.js";

export async function encodePairingEndpoint(
  endpointUrl: string,
  addresses: readonly Multiaddr[],
  secret: string,
) {
  if (addresses.length === 0) {
    throw new Error("Pairing endpoint requires at least one address");
  }

  const encodedAddresses = ccc.bytesTo(
    await transformBytes(
      encodeAddresses(addresses),
      new CompressionStream("deflate"),
    ),
    "base64url",
  );

  const url = new URL(endpointUrl);
  const params = url.searchParams;

  params.delete("addresses");
  params.delete("secret");
  params.set("addresses", encodedAddresses);
  params.set("secret", secret);

  return url.toString();
}

export async function decodePairingEndpoint(
  endpoint: string,
): Promise<PairingTarget> {
  const url = new URL(endpoint.trim());
  const params = url.searchParams;
  const compressedAddresses = params.get("addresses")?.trim();
  const secret = params.get("secret")?.trim();

  if (!compressedAddresses || !secret) {
    throw new Error("Pairing endpoint is incomplete");
  }

  const addresses = await decodeCompressedAddresses(compressedAddresses);

  return { addresses, secret };
}

function encodeAddresses(addresses: readonly Multiaddr[]): Uint8Array {
  return ccc.bytesConcat(
    ...lp.encode(addresses.map((address) => address.bytes)),
  );
}

async function decodeCompressedAddresses(value: string): Promise<Multiaddr[]> {
  try {
    const bytes = await transformBytes(
      ccc.bytesFrom(value, "base64url"),
      new DecompressionStream("deflate"),
    );
    const addresses = Array.from(lp.decode([bytes]), (address) =>
      multiaddr(address.subarray()),
    );

    if (addresses.length === 0) {
      throw new Error("Missing addresses");
    }
    return addresses;
  } catch (cause) {
    throw new Error("Pairing endpoint contains invalid compressed addresses", {
      cause,
    });
  }
}

async function transformBytes(
  bytes: Uint8Array,
  transform: CompressionStream | DecompressionStream,
) {
  const output = new Response(transform.readable).arrayBuffer().then(
    (buffer) => ({ buffer, ok: true }) as const,
    (error: unknown) => ({ error, ok: false }) as const,
  );
  const writer = transform.writable.getWriter();
  try {
    await writer.write(Uint8Array.from(bytes));
    await writer.close();
  } catch (cause) {
    await output;
    throw cause;
  }

  const result = await output;
  if (!result.ok) {
    throw result.error;
  }
  return new Uint8Array(result.buffer);
}
