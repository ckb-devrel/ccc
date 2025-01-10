import { ccc } from "@ckb-ccc/ccc";
import { render, signer } from "@ckb-ccc/playground";
// NOTE: Please use ckt1qzda0cr08m85hc8jlnfp3zer7xulejywt49kt2rr0vthywaa50xwsq2jk6pyw9vlnfakx7vp4t5lxg0lzvvsp3c5adflu as the signer
const executor = new ccc.ssri.ExecutorJsonRpc("http://localhost:9090");

const pudtScriptCell = await signer.client.findSingletonCellByType({
  // TypeID Code Hash. Don't change
  codeHash:
    "0x00000000000000000000000000000000000000000000000000545950455f4944",
  hashType: "type",
  // TypeID args. Change it to the args of the Type ID script of your UDT
  args: "0x738072698a31dab785b1b464e0a0aa06d2c8ab5dd52ea8a36a759cbf83301977",
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
const targetReceiverAToUnpause =
  "ckt1qzda0cr08m85hc8jlnfp3zer7xulejywt49kt2rr0vthywaa50xwsqwfxam63un4ld5ephk83900h8fqwgn6ktc4kq0lj";
const targetReceiverBToUnpause =
  "ckt1qzda0cr08m85hc8jlnfp3zer7xulejywt49kt2rr0vthywaa50xwsqtsm4z8rqkt060h3ugwyvfhvyc8qqsf5vsh59ey9";

const { script: pausedReceiverScript } = await ccc.Address.fromString(
  pausedReceiver,
  signer.client,
);

const { script: targetReceiverAScript } = await ccc.Address.fromString(
  targetReceiverAToUnpause,
  signer.client,
);

const { script: targetReceiverBScript } = await ccc.Address.fromString(
  targetReceiverBToUnpause,
  signer.client,
);

// NOTE: This would sometimes fail for 36 ("Nothing To DO") if run again because it's already unpaused and it would be deduped. Run pause before unpausing them again
const pudtUnpauseTx = (
  await pudt.unpause(
    signer,
    [targetReceiverAScript, pausedReceiverScript],
    undefined,
    [targetReceiverBScript.hash()],
  )
).res;
await render(pudtUnpauseTx);

await pudtUnpauseTx.completeFeeBy(signer);
const pudtUnpauseTxHash = await signer.sendTransaction(pudtUnpauseTx);
console.log(pudtUnpauseTxHash);
// "0x7715e78b4c5ded8928027c6aa610468eafce81c88e48e1267c1b787f52bb4929"

// NOTE: This might be delayed if the transaction is not yet confirmed
const pudtPaused = await pudt.enumeratePaused();
console.log(pudtPaused);
// {"res":["0x787e97af6860c58fcecd12653714330c003f5b960e09f027295a49e3c41d609f"],"cellDeps":[{"txHash":"0x7715e78b4c5ded8928027c6aa610468eafce81c88e48e1267c1b787f52bb4929","index":"0"}]}
