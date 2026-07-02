import { ccc } from "@ckb-ccc/ccc";
import { css, html, LitElement, PropertyValues } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { repeat } from "lit/directives/repeat.js";
import { CKB_SVG } from "../assets/chains/index.js";
import { DISCONNECT_SVG } from "../assets/diconnect.svg.js";
import { SWAP_SVG } from "../assets/swap.svg.js";
import { USER_SVG } from "../assets/user.svg.js";
import { SelectClientEvent } from "../events/index.js";
import { signerTypeToIcon } from "./selecting/signers.js";

export function formatString(
  str: string | undefined,
  l = 9,
  r = 6,
): string | undefined {
  if (str && str.length > l + r + 3) {
    return `${str.slice(0, l)}...${str.slice(-r)}`;
  }
  return str;
}

@customElement("ccc-connected-scene")
export class ConnectedScene extends LitElement {
  @property()
  public hideMark: unknown;
  @property()
  public wallet?: ccc.Wallet;
  @property()
  public signer?: ccc.Signer;
  @property()
  public clientOptions?: { icon?: string; client: ccc.Client; name: string }[];

  @state()
  private recommendedAddress?: string;
  @state()
  private internalAddress?: string;
  @state()
  private balance?: ccc.Num;
  @state()
  private selectingClient = false;

  willUpdate(changedProperties: PropertyValues<this>): void {
    if (
      (!this.recommendedAddress ||
        !this.internalAddress ||
        !this.balance ||
        changedProperties.has("signer")) &&
      this.signer
    ) {
      void this.signer
        .getRecommendedAddress()
        .then((v) => (this.recommendedAddress = v));
      void this.signer
        .getInternalAddress()
        .then((v) => (this.internalAddress = v));
      void this.signer.getBalance().then((v) => (this.balance = v));
    }
  }

  render() {
    const { wallet, signer, internalAddress, balance, recommendedAddress } =
      this;
    if (!wallet || !signer) {
      return html`<div></div>`;
    }

    const body = (() => {
      if (!this.selectingClient || !this.clientOptions) {
        return html`
          <div class="position-relative">
            <img
              class="connecting-wallet-icon"
              src=${wallet.icon}
              alt=${wallet.name}
            />
            <img
              class="connected-type-icon"
              src=${signerTypeToIcon(signer.type)}
              alt=${signer.type}
            />
          </div>

          <ccc-copy-button
            value=${recommendedAddress}
            class="text-bold fs-xl mt-2"
          >
            ${formatString(recommendedAddress)}
          </ccc-copy-button>
          <div class="text-bold fs-md">
            ${ccc.fixedPointToString(balance ?? ccc.Zero)} CKB
          </div>
          <ccc-copy-button
            value=${internalAddress}
            class="text-bold text-tip fs-md"
            style="margin-top: 0.5rem"
          >
            ${formatString(internalAddress, 11, 9)}
          </ccc-copy-button>

          <ccc-button
            class="mt-2"
            @click=${() => window.open("https://mobit.app/", "_blank")}
          >
            ${USER_SVG} Manage
          </ccc-button>

          <ccc-button
            class="mt-1"
            @click=${() => this.dispatchEvent(new Event("disconnect"))}
          >
            ${DISCONNECT_SVG} Disconnect
          </ccc-button>

          ${
            this.hideMark == null
              ? html`<a href="https://github.com/ckb-devrel/ccc" class="mark"
                  >Powered by CCC</a
                >`
              : ""
          }

          <div
            class="switch-btn-container ${
              this.clientOptions ? "cursor-pointer" : ""
            }"
            @click=${() => (this.selectingClient = Boolean(this.clientOptions))}
          >
            <div class="switch-line"></div>
            <div class="switch-content ml-2 mr-2 fs-sm">
              <img class="sm-chain-logo" src=${CKB_SVG} alt="Nervos Network" />
              ${signer.client.addressPrefix === "ckb" ? "Mainnet" : "Testnet"}
              ${
                ["ckb", "ckt"].includes(signer.client.addressPrefix)
                  ? ""
                  : ` ${signer.client.addressPrefix}`
              }
              ${this.clientOptions ? SWAP_SVG : undefined}
            </div>
            <div class="switch-line"></div>
          </div>
        `;
      }

      return repeat(
        this.clientOptions,
        ({ name }) => name,
        ({ client, name, icon }) => html`
          <ccc-button
            class="mt-1"
            @click=${() => this.dispatchEvent(new SelectClientEvent(client))}
          >
            <img src=${icon ?? CKB_SVG} alt=${name} />
            ${name}
          </ccc-button>
        `,
      );
    })();

    return html`
      <ccc-dialog
        header=${this.selectingClient ? "Select Network" : undefined}
        ?canBack=${this.selectingClient}
        @back=${() => (this.selectingClient = false)}
      >
        ${body}
      </ccc-dialog>
    `;
  }

  static styles = css`
    :host {
      width: 100%;
      display: flex;
      flex-direction: column;
      align-items: center;
    }

    .primary-icon {
      color: var(--icon-primary);
    }
    .secondary-icon {
      color: var(--icon-secondary);
    }

    .text-bold {
      font-weight: bold;
    }

    .text-tip {
      color: var(--tip-color);
    }

    .fs-sm {
      font-size: 0.8rem;
    }
    .fs-md {
      font-size: 1rem;
    }
    .fs-xl {
      font-size: 1.5rem;
    }

    .mt-1 {
      margin-top: 0.7rem;
    }
    .mt-2 {
      margin-top: 1rem;
    }
    .ml-1 {
      margin-left: 0.7em;
    }
    .ml-2 {
      margin-left: 1em;
    }
    .mr-1 {
      margin-right: 0.7rem;
    }
    .mr-2 {
      margin-right: 1rem;
    }

    .connecting-wallet-icon {
      width: 5rem;
      height: 5rem;
      border-radius: 1rem;
    }

    .position-relative {
      position: relative;
    }

    .connected-type-icon {
      position: absolute;
      width: 1.5rem;
      height: 1.5rem;
      right: -0.5rem;
      bottom: -0.5rem;
    }

    .switch-btn-container {
      width: 100%;
      margin-top: 1.2rem;
      display: flex;
      justify-content: center;
      align-items: center;
    }

    .cursor-pointer {
      cursor: pointer;
    }

    .switch-content {
      display: flex;
      align-items: center;
      gap: 0.7rem;
    }

    .switch-line {
      flex: 1;
      height: 1px;
      background-color: var(--divider);
    }

    .switching-status-dot {
      width: 0.5rem;
      height: 0.5rem;
      background: #0f0;
      border-radius: 50%;
    }

    .copy-btn {
      width: 1.5rem;
      height: 1.5rem;
    }

    .copy-btn-sm {
      width: 1rem;
      height: 1rem;
    }

    .sm-chain-logo {
      width: 1.125rem;
    }

    .mark {
      text-decoration: none;
      cursor: pointer;
      opacity: 0.2;
      margin: 0;
      margin-top: 0.25rem;
      margin-bottom: -1.05rem;
      color: var(--tip-color);
      font-size: 0.6rem;
    }

    .mark:hover {
      opacity: 0.5;
    }
  `;

  updated() {
    this.dispatchEvent(new Event("updated", { bubbles: true, composed: true }));
  }
}
