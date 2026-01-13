import { ccc } from "@ckb-ccc/core";
import type { Bridge } from "./advancedBarrel";
import { CkbSigner } from "./ckb/index.js";

/**
 * @public
 */
export function getSupeRISESigners(
  client: ccc.Client,
  _preferredNetworks?: ccc.NetworkPreference[],
): ccc.SignerInfo[] {
  const windowRef = window as {
    superise?: Bridge;
  };

  if (typeof windowRef.superise === "undefined") {
    return [];
  }

  return [
    {
      name: "CKB",
      signer: new CkbSigner(windowRef.superise, client),
    },
  ];
}
