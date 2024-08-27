import { ccc } from "@ckb-ccc/core";
import { isStandaloneBrowser } from "@joyid/common";
import { BitcoinSigner } from "../btc/index.js";
import { CkbSigner } from "../ckb/index.js";
import { EvmSigner } from "../evm/index.js";
import { NostrSigner } from "../nostr/index.js";

/**
 * Gets the JoyID signers based on the client, name, and icon.
 * If the browser is standalone or a webview, returns SignerAlwaysError instances.
 * Otherwise, returns instances of CkbSigner, BitcoinSigner, and EvmSigner.
 * @public
 *
 * @param client - The client instance.
 * @param name - The name of the signer.
 * @param icon - The icon URL of the signer.
 * @returns An array of signer information objects.
 */
export function getJoyIdSigners(
  client: ccc.Client,
  name: string,
  icon: string,
  preferredNetworks?: ccc.NetworkPreference[],
): ccc.SignerInfo[] {
  if (isStandaloneBrowser() || ccc.isWebview(window.navigator.userAgent)) {
    return [ccc.SignerType.CKB, ccc.SignerType.EVM, ccc.SignerType.BTC].map(
      (type) => ({
        name: type,
        signer: new ccc.SignerAlwaysError(
          client,
          type,
          "JoyID can only be used with standard browsers",
        ),
      }),
    );
  }

  return [
    {
      name: "CKB",
      signer: new CkbSigner(client, name, icon),
    },
    {
      name: "BTC",
      signer: new BitcoinSigner(client, name, icon, preferredNetworks),
    },
    {
      name: "Nostr",
      signer: new NostrSigner(client, name, icon),
    },
    {
      name: "EVM",
      signer: new EvmSigner(client, name, icon),
    },
    {
      name: "BTC (P2WPKH)",
      signer: new BitcoinSigner(
        client,
        name,
        icon,
        preferredNetworks,
        "p2wpkh",
      ),
    },
    {
      name: "BTC (P2TR)",
      signer: new BitcoinSigner(client, name, icon, preferredNetworks, "p2tr"),
    },
  ];
}
