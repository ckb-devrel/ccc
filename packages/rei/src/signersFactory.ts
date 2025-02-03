import { ccc } from "@ckb-ccc/core";
import { Provider } from "./advancedBarrel.js";
import { ReiSigner } from "./signer.js";

/**
 * Retrieves the Rei signer if available.
 * @param {ccc.Client} client - The client instance.
 * @returns {Signer | undefined} The Signer instance if the Rei provider is available, otherwise undefined.

 */
export function getReiSigners(client: ccc.Client): ccc.SignerInfo[] {
  const windowRef = window as { rei?:{ckb: Provider} };

  if (typeof windowRef?.rei?.ckb === "undefined") {
    return [];
  }
  return [
    {
      signer: new ReiSigner(client, windowRef.rei.ckb),
      name: "CKB",
    },
  ];
}
