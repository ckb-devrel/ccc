import { ccc } from "@ckb-ccc/ccc";
import { signer } from "@ckb-ccc/playground";

const executor = new ccc.ssri.ExecutorJsonRpc("http://localhost:9090");

const pudtScriptCell = await signer.client.findSingletonCellByType({
  // TypeID Code Hash. Don't change
  codeHash:
    "0x00000000000000000000000000000000000000000000000000545950455f4944",
  hashType: "type",
  // TypeID args. Change it to the args of the Type ID script of your UDT
  args: "0x8fd55df879dc6176c95f3c420631f990ada2d4ece978c9512c39616dead2ed56",
});
if (!pudtScriptCell) {
  throw new Error("PUDT script cell not found");
}

const pudtCodeHash = pudtScriptCell.cellOutput.type?.hash();
if (!pudtCodeHash) {
  throw new Error("PUDT code hash not found");
}

const pudt = new ccc.ssri.Trait(pudtScriptCell.outPoint, executor);

const pudtMethods = await pudt.getMethods();

console.log(pudtMethods);
///
// {"res":["0x6f2a4642323106f8","0x58f02409de9de7b1","0xb43d1128f8726c19","0xc78a67cec2fcc54f","0x35fa711c8c918aad","0x2f87f08056af234d","0xa306f89e40893737","0x235c6c5c6ee04b08","0x9adf445d336222e1","0x2e04fafee9f986ea","0x03cd9ce840759d42","0x849def40c0e9a525","0x43f92b1ceda6fa2b"],"cellDeps":[]}
