import { describe, expect, it, vi } from "vitest";
import { Address } from "../address/index.js";
import type { ScriptLike } from "../ckb/index.js";
import type { Client } from "./client.js";
import { ClientPublicMainnet } from "./clientPublicMainnet.js";
import { ClientPublicTestnet } from "./clientPublicTestnet.js";

const transport = {
  request: async () => {
    throw new Error("Unexpected request");
  },
};

const script = {
  codeHash:
    "0x9bd7e06f3ecf4be0f2fcd2188b23f1b9fcc88e5d4b65a8637b17723bbda3cce8",
  hashType: "type" as const,
  args: "0x0000000000000000000000000000000000000000",
};
const testnetAddress = Address.from({ script, prefix: "ckt" }).toString();

function resolverOf(names: Record<string, ScriptLike>) {
  return {
    shouldResolve: vi.fn((address: string) => address.endsWith(".example")),
    resolve: vi.fn(async (address: string) => names[address]),
  };
}

type Resolver = ReturnType<typeof resolverOf>;

describe("Client address resolver", () => {
  it.each([
    {
      factory: "ClientPublicTestnet.new",
      prefix: "ckt",
      create: (addressResolver: Resolver) => ({
        client: ClientPublicTestnet.new({ transport, addressResolver }),
        dispose: async () => {},
      }),
    },
    {
      factory: "ClientPublicTestnet.open",
      prefix: "ckt",
      create: (addressResolver: Resolver) => {
        const owner = ClientPublicTestnet.open({
          urls: ["https://example.com/"],
          addressResolver,
        });
        return { client: owner.value, dispose: () => owner.dispose() };
      },
    },
    {
      factory: "ClientPublicMainnet.new",
      prefix: "ckb",
      create: (addressResolver: Resolver) => ({
        client: ClientPublicMainnet.new({ transport, addressResolver }),
        dispose: async () => {},
      }),
    },
    {
      factory: "ClientPublicMainnet.open",
      prefix: "ckb",
      create: (addressResolver: Resolver) => {
        const owner = ClientPublicMainnet.open({
          urls: ["https://example.com/"],
          addressResolver,
        });
        return { client: owner.value, dispose: () => owner.dispose() };
      },
    },
  ])(
    "resolves through $factory with the client's prefix",
    async ({ prefix, create }) => {
      const addressResolver = resolverOf({ "alice.example": script });
      const { client, dispose } = create(addressResolver);

      try {
        const address = await Address.fromString("alice.example", client);

        expect(address.toString()).toBe(
          Address.from({ script, prefix }).toString(),
        );
        expect(addressResolver.resolve).toHaveBeenCalledWith(
          "alice.example",
          client,
        );
      } finally {
        await dispose();
      }
    },
  );

  it("does not consult the resolver for an address that parses", async () => {
    const addressResolver = resolverOf({});
    const client = ClientPublicTestnet.new({ transport, addressResolver });

    await Address.fromString(testnetAddress, client);

    expect(addressResolver.shouldResolve).not.toHaveBeenCalled();
    expect(addressResolver.resolve).not.toHaveBeenCalled();
  });

  it("keeps the parse error when the resolver does not handle it", async () => {
    const addressResolver = resolverOf({});
    const client = ClientPublicTestnet.new({ transport, addressResolver });

    await expect(Address.fromString("alice.other", client)).rejects.toThrow(
      "Unknown address format alice.other",
    );
    expect(addressResolver.resolve).not.toHaveBeenCalled();
  });

  it("throws when the resolver handles it but does not find it", async () => {
    const client = ClientPublicTestnet.new({
      transport,
      addressResolver: resolverOf({}),
    });

    await expect(Address.fromString("bob.example", client)).rejects.toThrow(
      "Address bob.example not found",
    );
  });

  it("does not resolve with a record of clients", async () => {
    const addressResolver = resolverOf({ "alice.example": script });
    const client = ClientPublicTestnet.new({ transport, addressResolver });

    await expect(
      Address.fromString("alice.example", { ckt: client }),
    ).rejects.toThrow("Unknown address format alice.example");
    expect(addressResolver.shouldResolve).not.toHaveBeenCalled();
  });

  it("resolves with a client from another copy of the package", async () => {
    const addressResolver = resolverOf({ "alice.example": script });
    const client = {
      addressPrefix: "ckt",
      addressResolver,
    } as unknown as Client;

    const address = await Address.fromString("alice.example", client);

    expect(address.toString()).toBe(testnetAddress);
  });
});
