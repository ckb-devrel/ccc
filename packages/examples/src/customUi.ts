import { ccc } from "@ckb-ccc/ccc";
import { client } from "@ckb-ccc/playground";

// For full supported wallets list, check https://api.ckbccc.com/
const signer = new ccc.JoyId.CkbSigner(client, "CCC", "https://fav.farm/🇨");

// Connect signer
await signer.connect();
console.log("Connected");

// Sign an empty transaction as test
const signature = await signer.signTransaction({});
console.log(signature);
