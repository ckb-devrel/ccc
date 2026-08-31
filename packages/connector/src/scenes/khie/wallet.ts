import { ccc } from "@ckb-ccc/ccc";
import { KHIE_SVG } from "../../assets/khie.svg.js";

export const KHIE_WALLET_NAME = "Khie";

export function khieSignerIcon(icon: string | undefined): string {
  if (!icon) {
    return KHIE_SVG;
  }

  try {
    const url = new URL(icon);
    if (
      url.protocol === "https:" ||
      (url.protocol === "data:" && /^data:image\//i.test(icon))
    ) {
      return icon;
    }
  } catch {
    // Fall through to the default Khie icon.
  }

  return KHIE_SVG;
}

export function khieWalletFrom(signer: ccc.SignerJsonRpc): ccc.Wallet {
  return {
    name: signer.name ?? KHIE_WALLET_NAME,
    icon: khieSignerIcon(signer.icon),
  };
}
