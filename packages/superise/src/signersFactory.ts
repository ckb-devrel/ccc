import { ccc } from "@ckb-ccc/core";
import type SupeRISE from "@superise/bridge-api-types";
import { CkbSigner } from "./ckb/index.js";

/**
 * @public
 */
export function getSupeRISESigners(
  client: ccc.Client,
  _preferredNetworks?: ccc.NetworkPreference[],
): ccc.SignerInfo[] {
  const windowRef = window as {
    superise?: SupeRISE.Bridge;
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
