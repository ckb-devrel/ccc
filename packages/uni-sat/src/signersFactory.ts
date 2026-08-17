import { ccc } from "@ckb-ccc/core";
import { Provider } from "./advancedBarrel.js";
import { Signer } from "./signer.js";

/**
 * Retrieves the UniSat signer if available.
 * @public
 *
 * @param client - The client instance.
 * @returns The Signer instance if the UniSat provider is available, otherwise undefined.
 */
export function getUniSatSigners(
  client: ccc.Client,
  preferredNetworks?: ccc.NetworkPreference[],
): ccc.SignerInfo[] {
  const windowRef = window as { unisat?: Provider };

  if (typeof windowRef.unisat === "undefined") {
    return [];
  }

  return [
    ["BTC", "btc"],
    ["BTC Testnet", "btcTestnet"],
    ["BTC Testnet4", "btcTestnet4"],
    ["BTC Signet", "btcSignet"],
    ["Fractal Bitcoin", "fractalBtc"],
    ["Fractal Bitcoin Testnet", "fractalBtcTestnet"],
  ]
    .filter(
      ([, network]) =>
        client.addressPrefix !== "ckb" ||
        network === "btc" ||
        network === "fractalBtc",
    )
    .map(([name, network]) => ({
      signer: new Signer(client, windowRef.unisat!, preferredNetworks, network),
      name,
    }));
}
