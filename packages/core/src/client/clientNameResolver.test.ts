import { describe, expect, it, vi } from "vitest";
import { Address } from "../address/index.js";
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
const mainnetAddress = Address.from({ script, prefix: "ckb" }).toString();

function resolverOf(names: Record<string, string>) {
  return {
    suffixes: [".example"],
    resolve: vi.fn(async (name: string) => names[name]),
  };
}

describe("Client name resolver", () => {
  it.each([
    {
      factory: "ClientPublicTestnet.new",
      address: testnetAddress,
      create: (nameResolver: ReturnType<typeof resolverOf>) => ({
        client: ClientPublicTestnet.new({ transport, nameResolver }),
        dispose: async () => {},
      }),
    },
    {
      factory: "ClientPublicTestnet.open",
      address: testnetAddress,
      create: (nameResolver: ReturnType<typeof resolverOf>) => {
        const owner = ClientPublicTestnet.open({
          urls: ["https://example.com/"],
          nameResolver,
        });
        return {
          client: owner.value,
          dispose: () => owner.dispose(),
        };
      },
    },
    {
      factory: "ClientPublicMainnet.new",
      address: mainnetAddress,
      create: (nameResolver: ReturnType<typeof resolverOf>) => ({
        client: ClientPublicMainnet.new({ transport, nameResolver }),
        dispose: async () => {},
      }),
    },
    {
      factory: "ClientPublicMainnet.open",
      address: mainnetAddress,
      create: (nameResolver: ReturnType<typeof resolverOf>) => {
        const owner = ClientPublicMainnet.open({
          urls: ["https://example.com/"],
          nameResolver,
        });
        return {
          client: owner.value,
          dispose: () => owner.dispose(),
        };
      },
    },
  ])(
    "resolves a name configured through $factory",
    async ({ address, create }) => {
      const nameResolver = resolverOf({ "alice.example": address });
      const { client, dispose } = create(nameResolver);

      try {
        const resolved = await Address.fromString("alice.example", client);

        expect(resolved.toString()).toBe(address);
        expect(nameResolver.resolve).toHaveBeenCalledWith(
          "alice.example",
          client,
        );
      } finally {
        await dispose();
      }
    },
  );

  it("does not ask the resolver about an address", async () => {
    const nameResolver = resolverOf({});
    const client = ClientPublicTestnet.new({ transport, nameResolver });

    await Address.fromString(testnetAddress, client);

    expect(nameResolver.resolve).not.toHaveBeenCalled();
  });

  it("does not ask the resolver about a suffix it does not claim", async () => {
    const nameResolver = resolverOf({});
    const client = ClientPublicTestnet.new({ transport, nameResolver });

    await expect(Address.fromString("alice.other", client)).rejects.toThrow(
      "Unknown address format alice.other",
    );
    expect(nameResolver.resolve).not.toHaveBeenCalled();
  });

  it("keeps the parse error when the resolver does not know the name", async () => {
    const client = ClientPublicTestnet.new({
      transport,
      nameResolver: resolverOf({}),
    });

    await expect(Address.fromString("alice.example", client)).rejects.toThrow(
      "Unknown address format alice.example",
    );
  });

  it("checks the prefix of the resolved address", async () => {
    const client = ClientPublicTestnet.new({
      transport,
      nameResolver: resolverOf({ "alice.example": mainnetAddress }),
    });

    await expect(Address.fromString("alice.example", client)).rejects.toThrow(
      "Unknown address prefix ckb, expected ckt",
    );
  });

  it("does not resolve names with a record of clients", async () => {
    const nameResolver = resolverOf({ "alice.example": testnetAddress });
    const client = ClientPublicTestnet.new({ transport, nameResolver });

    await expect(
      Address.fromString("alice.example", { ckt: client }),
    ).rejects.toThrow("Unknown address format alice.example");
    expect(nameResolver.resolve).not.toHaveBeenCalled();
  });
});
