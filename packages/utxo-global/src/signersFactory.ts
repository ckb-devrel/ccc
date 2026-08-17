import { ccc } from "@ckb-ccc/core";
import { Provider } from "./advancedBarrel.js";
import { SignerBtc } from "./btc/index.js";
import { SignerCkb } from "./ckb/index.js";
import { SignerDoge } from "./doge/index.js";

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
      dogeSigner: Provider;
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
    ...[
      ["BTC", "btc"],
      ["BTC Testnet", "btcTestnet"],
      ["BTC Testnet4", "btcTestnet4"],
      ["BTC Signet", "btcSignet"],
    ]
      .filter(
        ([, network]) => client.addressPrefix !== "ckb" || network === "btc",
      )
      .map(([name, network]) => ({
        name,
        signer: new SignerBtc(
          client,
          windowRef.utxoGlobal!.bitcoinSigner,
          preferredNetworks,
          network,
        ),
      })),
    ...[
      ["DOGE", "doge"],
      ["DOGE Testnet", "dogeTestnet"],
    ]
      .filter(
        ([, network]) => client.addressPrefix !== "ckb" || network === "doge",
      )
      .map(([name, network]) => ({
        name,
        signer: new SignerDoge(
          client,
          windowRef.utxoGlobal!.dogeSigner,
          preferredNetworks,
          network,
        ),
      })),
  ];
}
