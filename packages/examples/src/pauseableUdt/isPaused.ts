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
const pudtType = {
  codeHash: pudtCodeHash,
  hashType: "type",
  args: "0x02c93173368ec56f72ec023f63148461b80e7698eddd62cbd9dbe31a13f2b330",
};

const pudt = new ccc.udt.UdtPausable(pudtScriptCell.outPoint, pudtType, {
  executor,
});

const pausedReceiver =
  "ckt1qzda0cr08m85hc8jlnfp3zer7xulejywt49kt2rr0vthywaa50xwsqgy2q6qz79wyaexr2pcez0eejmk5xgw6jcfw7zmg";

const { script: pausedReceiverScript } = await ccc.Address.fromString(
  pausedReceiver,
  signer.client,
);

const pudtIsPaused = await pudt.isPaused(
  [pausedReceiverScript],
  ["0x787e97af6860c58fcecd12653714330c003f5b960e09f027295a49e3c41d609f"],
);

console.log(pudtIsPaused);
// {"res":[true,false],"cellDeps":[]}
