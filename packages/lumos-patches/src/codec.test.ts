import { Base, extendsBase, HashType, Hex } from "@ckb-ccc/core";
import { blockchain } from "@ckb-lumos/base";

class Script extends Base {
  constructor(
    public codeHash: Hex,
    public hashType: HashType,
    public args: Hex,
  ) {
    super();
  }
}

const ScriptCCCModel = extendsBase(
  Script,
  (bytes) => {
    const script = blockchain.Script.unpack(bytes);
    return [script.codeHash as Hex, script.hashType, script.args as Hex];
  },
  (instance) => blockchain.Script.pack(instance),
);

test("simple extendsBase with codec", () => {
  const script = new ScriptCCCModel(
    "0x0000000000000000000000000000000000000000000000000000000000000000",
    "type",
    "0x",
  );

  const bytes = script.toBytes();

  expect(ScriptCCCModel.fromBytes(bytes).eq(script)).toBe(true);
});
