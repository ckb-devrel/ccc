import { describe, expect, it } from "vitest";
import { ccc } from "../../index.js";

describe("SignerCkbAlwaysSuccess", () => {
  const scriptInfo = ccc.ScriptInfo.from({
    codeHash:
      "0x0000000000000000000000000000000000000000000000000000000000000000",
    hashType: "data1",
    cellDeps: [
      {
        cellDep: {
          outPoint: {
            txHash:
              "0x0000000000000000000000000000000000000000000000000000000000000000",
            index: 0,
          },
          depType: "code",
        },
      },
    ],
  });
  const client = {
    addressPrefix: "ckt",
    getKnownScript: async () => scriptInfo,
    getCellDeps: async () => scriptInfo.cellDeps.map(({ cellDep }) => cellDep),
  } as unknown as ccc.Client;
  const signer = new ccc.SignerCkbAlwaysSuccess(client);

  it("uses the always-success script with empty args", async () => {
    const addresses = await signer.getAddressObjs();

    expect(addresses).toHaveLength(1);
    expect(signer.type).toBe(ccc.SignerType.CKB);
    expect(signer.signType).toBe(ccc.SignerSignType.Unknown);
    expect(await signer.isConnected()).toBe(true);
    expect(addresses[0].script).toEqual(
      ccc.Script.from({
        codeHash: scriptInfo.codeHash,
        hashType: scriptInfo.hashType,
        args: "0x",
      }),
    );
  });

  it("adds the always-success cell dep while signing", async () => {
    const tx = ccc.Transaction.default();

    const signed = await signer.signTransaction(tx);

    expect(signed.cellDeps).toHaveLength(1);
    expect(signed.cellDeps[0].eq(scriptInfo.cellDeps[0].cellDep)).toBe(true);

    const signedAgain = await signer.signTransaction(signed);
    expect(signedAgain.cellDeps).toHaveLength(1);
  });
});
