import { describe, expect, it } from "vitest";
import { ClientPublicTestnet } from "./clientPublicTestnet.js";
import { KnownScript } from "./knownScript.js";

const transport = {
  request: async () => {
    throw new Error("Unexpected request");
  },
};

describe("Client known scripts", () => {
  it("uses the network's default scripts", async () => {
    const client = ClientPublicTestnet.new({ transport });

    const script = await client.getKnownScript(KnownScript.TypeId);

    expect(script.codeHash).toBe(
      "0x00000000000000000000000000000000000000000000000000545950455f4944",
    );
  });

  it("uses a custom scripts registry", async () => {
    const scripts = {
      [KnownScript.TypeId]: {
        codeHash:
          "0x1111111111111111111111111111111111111111111111111111111111111111",
        hashType: "data" as const,
        cellDeps: [],
      },
    };
    const client = ClientPublicTestnet.new({ scripts, transport });

    const script = await client.getKnownScript(KnownScript.TypeId);

    expect(client.scripts).toBe(scripts);
    expect(script.codeHash).toBe(scripts[KnownScript.TypeId].codeHash);
    await expect(client.getKnownScript(KnownScript.NervosDao)).rejects.toThrow(
      "No script information was found for NervosDao on ckt",
    );
  });
});
