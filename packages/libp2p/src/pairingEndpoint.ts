import { ccc } from "@ckb-ccc/core";
import { multiaddr, type Multiaddr } from "@multiformats/multiaddr";
import * as lp from "it-length-prefixed";
import type { PairingTarget } from "./pairingService.js";

const MAX_DECOMPRESSED_ADDRESSES_LENGTH = 16 * 1024;
const MAX_ADDRESSES = 16;
const PAIRING_PARAMETER_NAMES = ["addresses", "role", "secret"] as const;

export class PairingEndpointRoleError extends Error {
  constructor(
    readonly expectedRole: string,
    readonly actualRole: string | undefined,
  ) {
    super(
      `Expected a ${expectedRole} pairing endpoint, received ${actualRole ? `role "${actualRole}"` : "an endpoint without a role"}`,
    );
    this.name = "PairingEndpointRoleError";
  }
}

export async function encodePairingEndpoint(
  endpointUrl: string,
  addresses: readonly Multiaddr[],
  secret: string,
  role?: string,
) {
  if (addresses.length === 0) {
    throw new Error("Pairing endpoint requires at least one address");
  }
  if (addresses.length > MAX_ADDRESSES) {
    throw new Error(
      `Pairing endpoint supports at most ${MAX_ADDRESSES} addresses`,
    );
  }

  const addressBytes = encodeAddresses(addresses);
  if (addressBytes.byteLength > MAX_DECOMPRESSED_ADDRESSES_LENGTH) {
    throw new Error("Pairing endpoint address data is too large");
  }

  const compressedAddressBytes = await transformBytes(
    addressBytes,
    new CompressionStream("deflate"),
  );

  const encodedAddresses = ccc.bytesTo(compressedAddressBytes, "base64url");

  const url = new URL(endpointUrl);
  const { params, route } = fragmentParameters(url);

  PAIRING_PARAMETER_NAMES.forEach((name) => {
    params.delete(name);
  });
  if (role) {
    params.set("role", role);
  }
  params.set("addresses", encodedAddresses);
  params.set("secret", secret);
  url.hash = `${route}?${params.toString()}`;

  return url.toString();
}

export async function decodePairingEndpoint(
  endpoint: string,
  expectedRole?: string,
): Promise<PairingTarget> {
  const url = new URL(endpoint.trim());
  const { params } = fragmentParameters(url);
  if (expectedRole) {
    const actualRole = params.get("role")?.trim() || undefined;
    if (actualRole !== expectedRole) {
      throw new PairingEndpointRoleError(expectedRole, actualRole);
    }
  }
  const compressedAddresses = params.get("addresses")?.trim();
  const secret = params.get("secret")?.trim();

  if (!compressedAddresses || !secret) {
    throw new Error("Pairing endpoint is incomplete");
  }

  const addresses = await decodeCompressedAddresses(compressedAddresses);

  return { addresses, secret };
}

function fragmentParameters(url: URL) {
  const fragment = url.hash.slice(1);
  const separator = fragment.indexOf("?");
  if (separator === -1) {
    return { params: new URLSearchParams(), route: fragment };
  }

  return {
    params: new URLSearchParams(fragment.slice(separator + 1)),
    route: fragment.slice(0, separator),
  };
}

function encodeAddresses(addresses: readonly Multiaddr[]): Uint8Array {
  return ccc.bytesConcat(
    ...lp.encode(addresses.map((address) => address.bytes)),
  );
}

async function decodeCompressedAddresses(value: string): Promise<Multiaddr[]> {
  try {
    const compressedBytes = ccc.bytesFrom(value, "base64url");
    const bytes = await transformBytes(
      compressedBytes,
      new DecompressionStream("deflate"),
      MAX_DECOMPRESSED_ADDRESSES_LENGTH,
    );
    const addresses: Multiaddr[] = [];
    for (const address of lp.decode([bytes], {
      maxDataLength: MAX_DECOMPRESSED_ADDRESSES_LENGTH,
    })) {
      if (addresses.length >= MAX_ADDRESSES) {
        throw new Error("Too many addresses");
      }
      addresses.push(multiaddr(address.subarray()));
    }

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
  maxOutputLength?: number,
) {
  const readable =
    maxOutputLength === undefined
      ? transform.readable
      : transform.readable.pipeThrough(limitBytes(maxOutputLength));
  const output = new Response(readable).arrayBuffer().then(
    (buffer) => ({ buffer, ok: true }) as const,
    (error: unknown) => ({ error, ok: false }) as const,
  );
  const writer = transform.writable.getWriter();
  try {
    await writer.write(Uint8Array.from(bytes));
    await writer.close();
  } catch (cause) {
    const result = await output;
    if (!result.ok) {
      throw result.error;
    }
    throw cause;
  }

  const result = await output;
  if (!result.ok) {
    throw result.error;
  }
  return new Uint8Array(result.buffer);
}

function limitBytes(maxLength: number) {
  let length = 0;

  return new TransformStream<Uint8Array, Uint8Array>({
    transform(chunk, controller) {
      if (chunk.byteLength > maxLength - length) {
        throw new Error("Decompressed address data is too large");
      }
      length += chunk.byteLength;
      controller.enqueue(chunk);
    },
  });
}
