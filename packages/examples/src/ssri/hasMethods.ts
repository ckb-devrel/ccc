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

const pudtHasMethods = await pudt.hasMethods([
  "SSRI.get_methods",
  "SSRI.has_methods",
  "SSRI.version",
  "UDT.name",
  "UDT.symbol",
  "UDT.decimals",
  "UDT.icon",
  "UDT.transfer",
  "UDT.mint",
  "UDTPausable.pause",
  "UDTPausable.unpause",
  "UDTPausable.is_paused",
  "UDTPausable.enumerate_paused",
  "UNKNOWN",
]);

console.log(pudtHasMethods);
///
// {"res":[true,true,true,true,true,true,true,true,true,true,true,true,true,false],"cellDeps":[]}
///
