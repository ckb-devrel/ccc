import { ccc } from "@ckb-ccc/ccc";
import { html } from "lit";
import { repeat } from "lit/directives/repeat.js";
import { KHIE_SVG } from "../../assets/khie.svg.js";

export function generateWalletsScene(
  wallets: ccc.WalletWithSigners[],
  onWalletSelected: (wallet: ccc.WalletWithSigners) => unknown,
  onSignerSelected: (
    wallet: ccc.WalletWithSigners,
    signer: ccc.SignerInfo,
  ) => unknown,
) {
  return [
    "Connect Wallet",
    html`
      <ccc-button
        @click=${(event: Event) => {
          event.currentTarget?.dispatchEvent(
            new Event("select-khie", { bubbles: true, composed: true }),
          );
        }}
      >
        <img src=${KHIE_SVG} alt="Khie" />
        Khie
      </ccc-button>
      ${repeat(
        wallets,
        (wallet) => wallet.name,
        (wallet) => html`
          <ccc-button
            class="mt-1"
            @click=${() => {
              if (wallet.signers.length === 1) {
                onSignerSelected(wallet, wallet.signers[0]);
              } else {
                onWalletSelected(wallet);
              }
            }}
          >
            <img src=${wallet.icon} alt=${wallet.name} />
            ${wallet.name}
          </ccc-button>
        `,
      )}
    `,
  ];
}
