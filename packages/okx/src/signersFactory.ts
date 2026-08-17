import { ccc } from "@ckb-ccc/core";
import { BitcoinProvider, NostrProvider } from "./advancedBarrel.js";
import { BitcoinSigner } from "./btc/index.js";
import { NostrSigner } from "./nostr/index.js";

/**
 * Retrieves the OKX Bitcoin signer if available.
 * @public
 *
 * @param client - The client instance.
 * @returns The BitcoinSigner instance if the OKX wallet is available, otherwise undefined.
 */
export function getOKXSigners(
  client: ccc.Client,
  preferredNetworks?: ccc.NetworkPreference[],
): ccc.SignerInfo[] {
  const windowRef = window as {
    okxwallet?: Record<string, BitcoinProvider> & { nostr: NostrProvider };
  };

  const okxwallet = windowRef.okxwallet;
  if (typeof okxwallet === "undefined") {
    return [];
  }

  const btcSigners = [
    ["BTC", "btc"],
    ...(client.addressPrefix !== "ckb" && okxwallet.bitcoinSignet
      ? [["BTC Signet", "btcSignet"]]
      : []),
  ].map(([name, network]) => ({
    signer: new BitcoinSigner(client, okxwallet, preferredNetworks, network),
    name,
  }));

  return [
    ...btcSigners,
    {
      signer: new NostrSigner(client, okxwallet.nostr),
      name: "Nostr",
    },
  ];
}
