import { ccc } from "@ckb-ccc/core";
import "@superise/bridge-api-types";
import { CkbSigner } from "./ckb";

/**
 * @public
 */
export function getSupeRISESigners(
  client: ccc.Client,
  _preferredNetworks?: ccc.NetworkPreference[],
): ccc.SignerInfo[] {
  const windowRef = window;

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
