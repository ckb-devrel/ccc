import { ccc } from "@ckb-ccc/ccc";
import { html } from "lit";
import { repeat } from "lit/directives/repeat.js";
import {
  BTC_SVG,
  CKB_SVG,
  DOGE_SVG,
  ETH_SVG,
  NOSTR_SVG,
} from "../../assets/chains/index.js";

export function signerTypeToIcon(type: ccc.SignerType): string {
  return {
    [ccc.SignerType.BTC]: BTC_SVG,
    [ccc.SignerType.EVM]: ETH_SVG,
    [ccc.SignerType.CKB]: CKB_SVG,
    [ccc.SignerType.Nostr]: NOSTR_SVG,
    [ccc.SignerType.Doge]: DOGE_SVG,
  }[type];
}

export function generateSignersScene(
  wallet: ccc.WalletWithSigners,
  onSignerSelected: (
    wallet: ccc.WalletWithSigners,
    signer: ccc.SignerInfo,
  ) => unknown,
) {
  return [
    "Select a Chain",

    html`
      <img class="wallet-icon mt-1" src=${wallet.icon} alt=${wallet.name} />
      <span class="mb-1">${wallet.name}</span>
      ${repeat(
        wallet.signers,
        (signer) => signer.name,
        (signer) => html`
          <ccc-button
            class="mt-1"
            @click=${async () => {
              onSignerSelected(wallet, signer);
            }}
          >
            <img
              src=${signerTypeToIcon(signer.signer.type)}
              alt=${signer.signer.type}
            />
            ${signer.name}
          </ccc-button>
        `,
      )}
    `,
  ];
}
