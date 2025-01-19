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

// NOTE: This script doesn't contain external data cell while running pause would help you generate the first external data cell so you can upgrade the script accordingly.
const pudtnScriptCell = await signer.client.findSingletonCellByType({
  // TypeID Code Hash. Don't change
  codeHash:
    "0x00000000000000000000000000000000000000000000000000545950455f4944",
  hashType: "type",
  // TypeID args. Change it to the args of the Type ID script of your UDT
  args: "0x8fd55df879dc6176c95f3c420631f990ada2d4ece978c9512c39616dead2ed56",
});
if (!pudtnScriptCell) {
  throw new Error("PUDT script cell not found");
}

const pudtnCodeHash = pudtnScriptCell.cellOutput.type?.hash();
if (!pudtnCodeHash) {
  throw new Error("PUDT code hash not found");
}
const pudtnType = {
  codeHash: pudtnCodeHash,
  hashType: "type",
  args: "0x02c93173368ec56f72ec023f63148461b80e7698eddd62cbd9dbe31a13f2b330",
};

const pudtn = new ccc.udt.UdtPausable(pudtnScriptCell.outPoint, pudtnType, {
  executor,
});

const pausedReceiver =
  "ckt1qzda0cr08m85hc8jlnfp3zer7xulejywt49kt2rr0vthywaa50xwsqgy2q6qz79wyaexr2pcez0eejmk5xgw6jcfw7zmg";
const targetReceiverAToPause =
  "ckt1qzda0cr08m85hc8jlnfp3zer7xulejywt49kt2rr0vthywaa50xwsqwfxam63un4ld5ephk83900h8fqwgn6ktc4kq0lj";
const targetReceiverBToPause =
  "ckt1qzda0cr08m85hc8jlnfp3zer7xulejywt49kt2rr0vthywaa50xwsqtsm4z8rqkt060h3ugwyvfhvyc8qqsf5vsh59ey9";

const { script: pausedReceiverScript } = await ccc.Address.fromString(
  pausedReceiver,
  signer.client,
);

const { script: targetReceiverAScript } = await ccc.Address.fromString(
  targetReceiverAToPause,
  signer.client,
);

const { script: targetReceiverBScript } = await ccc.Address.fromString(
  targetReceiverBToPause,
  signer.client,
);

const pudtPauseTx = (
  await pudt.pause(
    signer,
    [targetReceiverAScript, pausedReceiverScript],
    undefined,
    [targetReceiverBScript.hash()],
  )
).res;
await render(pudtPauseTx);

const pudtnPauseTx = (
  await pudtn.pause(
    signer,
    [targetReceiverAScript, pausedReceiverScript],
    undefined,
    [targetReceiverBScript.hash()],
  )
).res;
await render(pudtnPauseTx);

await pudtPauseTx.completeFeeBy(signer);
await pudtnPauseTx.completeFeeBy(signer);
// NOTE: This would fail for 36 ("Nothing To DO") if run again because it's already paused and it would be deduped. Run unpause before pausing them again
const pudtPauseTxHash = await signer.sendTransaction(pudtPauseTx);
console.log(pudtPauseTxHash);
// "0xc8df6b7edaa295f4044107e5c7f5b20fffe6e36e37fcf6513337c2be8c354e39"
const pudtnPauseTxHash = await signer.sendTransaction(pudtnPauseTx);
console.log(pudtnPauseTxHash);
// "0x04fd05e091189d9beae525decd22d61cd8d63bd2ce6949369961fca7fa63a27b"

// NOTE: This won't change because you need to upgrade the script to see the change
const pudtnPaused = await pudtn.enumeratePaused();
console.log(pudtnPaused);
// {"res":[],"cellDeps":[]}

// NOTE: This might be delayed if the transaction is not yet confirmed
const pudtPaused = await pudt.enumeratePaused();
console.log(pudtPaused);
// {"res":["0x787e97af6860c58fcecd12653714330c003f5b960e09f027295a49e3c41d609f","0x0ac6e7d7ed8d8ac0832992f106dbebbd71a2cfa4791ef621dec081a047f7668d","0xa320a09489791af2e5e1fe84927eda84f71afcbd2c7a65cb419464fe46e75085","0x779c916fc89f7c7d03c97d7a2aa5cf4f854d4f279ef0a89f8568dc65e744b3a6"],"cellDeps":[{"txHash":"0xc8df6b7edaa295f4044107e5c7f5b20fffe6e36e37fcf6513337c2be8c354e39","index":"0"}]}
