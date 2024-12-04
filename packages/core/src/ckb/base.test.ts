import { randomBytes } from "node:crypto";
import { bytesEqual, bytesFrom } from "../barrel.js";
import { HashType } from "../ckb/script.js";
import { Hex, hexFrom } from "../hex/index.js";
import { Base, extendsBase } from "./base.js";

test("base", () => {
  class Script extends Base {
    constructor(
      public codeHash: Hex,
      public hashType: HashType,
      public args: Hex,
    ) {
      super();
    }
  }

  const codeHash = hexFrom(randomBytes(32));
  const args = hexFrom(randomBytes(32));
  const bytesToConstructorParams = jest.fn(
    (): ConstructorParameters<typeof Script> => [codeHash, "type", args],
  );

  const scriptBytes = hexFrom(randomBytes(8));
  const instanceToBytes = jest.fn(() => scriptBytes);

  const CCCScript = extendsBase(
    Script,
    bytesToConstructorParams,
    instanceToBytes,
  );

  expect(CCCScript.name).toBe("Script");

  const script1 = CCCScript.fromBytes(scriptBytes);
  const script2 = new CCCScript(codeHash, "type", args);

  expect(script1).toBeInstanceOf(CCCScript);
  expect(bytesToConstructorParams).toHaveBeenCalledWith(bytesFrom(scriptBytes));

  expect(script2.eq(script1)).toBe(true);
  expect(script2.hash()).toMatch(/^0x/);

  expect(bytesEqual(script1.toBytes(), script2.toBytes())).toBe(true);

  expect(script1.clone()).toEqual(script1);
  expect(script1.clone()).not.toBe(script1);
});
