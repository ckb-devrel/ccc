import { ccc } from "@ckb-ccc/core";
import { BtcProvider, Provider } from "./advancedBarrel.js";
import { Signer } from "./signer.js";

function getProviderById(providerId: string) {
  return (
    providerId
      ?.split(".")
      // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-return
      .reduce((acc: any, part) => acc?.[part], window) as BtcProvider
  );
}

/**
 * Retrieves the Xverse signer if available.
 * @public
 *
 * @param client - The client instance.
 * @returns All Xverse Signer instances
 */
export function getXverseSigners(
  client: ccc.Client,
  preferredNetworks?: ccc.NetworkPreference[],
): { wallet: ccc.Wallet; signerInfo: ccc.SignerInfo }[] {
  const windowRef = window as {
    BitcoinProvider?: BtcProvider;
    XverseProviders?: {
      BitcoinProvider?: BtcProvider;
    };
    btc_providers?: Provider[];
  };

  const signers = (() => {
    if (windowRef.btc_providers) {
      return windowRef.btc_providers.flatMap((provider) => {
        const networks =
          provider.name === "Xverse Wallet" ||
          (provider.methods?.includes("wallet_getNetwork") &&
            provider.methods.includes("wallet_changeNetwork"))
            ? (["Mainnet", "Testnet4", "Signet", "Regtest"] as const)
            : ([undefined] as const);

        return networks
          .filter(
            (network) =>
              client.addressPrefix !== "ckb" || network === "Mainnet",
          )
          .map((network) => ({
            wallet: {
              name: provider.name,
              icon: provider.icon,
            },
            signerInfo: {
              name: network && network !== "Mainnet" ? `BTC ${network}` : "BTC",
              signer: new Signer(
                client,
                getProviderById(provider.id),
                preferredNetworks,
                network,
              ),
            },
          }));
      });
    }

    return [];
  })();

  return signers;
}
