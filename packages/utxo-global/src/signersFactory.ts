import { ccc } from "@ckb-ccc/core";
import { Provider } from "./advancedBarrel.js";
import { SignerBtc } from "./btc/index.js";
import { SignerCkb } from "./ckb/index.js";

/**
 * @public
 */
export function getUtxoGlobalSigners(
  client: ccc.Client,
  preferredNetworks?: ccc.NetworkPreference[],
): ccc.SignerInfo[] {
  const windowRef = window as {
    utxoGlobal?: {
      bitcoinSigner: Provider;
      ckbSigner: Provider;
    };
  };

  if (typeof windowRef.utxoGlobal === "undefined") {
    return [];
  }

  return [
    {
      name: "CKB",
      signer: new SignerCkb(client, windowRef.utxoGlobal.ckbSigner),
    },
    {
      name: "BTC",
      signer: new SignerBtc(
        client,
        windowRef.utxoGlobal.bitcoinSigner,
        preferredNetworks,
      ),
    },
  ];
}
