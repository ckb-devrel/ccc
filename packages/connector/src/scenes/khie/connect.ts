import { ccc } from "@ckb-ccc/ccc";
import { css, html, LitElement } from "lit";
import { customElement, property, query, state } from "lit/decorators.js";
import { I18n } from "../../i18n/index.js";
import { displayError } from "../error.js";
import type { KhiePairing } from "./pairing.js";
import { KHIE_WALLET_NAME, khieSignerIcon } from "./wallet.js";

type KhieLoadStatus = "loading" | "ready" | "error";

@customElement("ccc-khie-connect-scene")
export class KhieConnectScene extends LitElement {
  @property({ attribute: false })
  public appName?: string;

  @property({ attribute: false })
  public client!: ccc.Client;

  @property({ attribute: false })
  public defaultRelayAddress?: string;

  @property({ attribute: false })
  public i18n = new I18n();

  @state()
  private status: KhieLoadStatus = "loading";
  @state()
  private error?: { cause: unknown };

  @query("ccc-khie-pairing")
  private khiePairing?: KhiePairing;

  private loadId = 0;

  connectedCallback() {
    super.connectedCallback();
    void this.loadKhie();
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.close();
  }

  render() {
    return html`<ccc-dialog
      header=${this.i18n.t("khieConnectWallet")}
      ?canBack=${true}
      @back=${this.back}
    >
      ${this.renderBody()}
    </ccc-dialog>`;
  }

  private renderBody() {
    if (this.status === "ready") {
      return html`<ccc-khie-pairing
        .appName=${this.appName}
        .client=${this.client}
        .defaultRelayAddress=${this.defaultRelayAddress}
        .i18n=${this.i18n}
      ></ccc-khie-pairing>`;
    }

    return html`<ccc-connecting
      .name=${KHIE_WALLET_NAME}
      .icon=${khieSignerIcon(undefined)}
      .error=${this.error && displayError(this.error.cause, this.i18n)}
      .hint=${this.i18n.t("khieLoading")}
      .i18n=${this.i18n}
      .onRetry=${this.status === "error" ? () => this.loadKhie() : undefined}
    ></ccc-connecting>`;
  }

  public close() {
    this.loadId += 1;
    this.khiePairing?.close();
  }

  private async loadKhie() {
    const loadId = ++this.loadId;
    this.status = "loading";
    this.error = undefined;

    try {
      await import("./pairing.js");
      if (loadId === this.loadId) {
        this.status = "ready";
      }
    } catch (cause) {
      if (loadId === this.loadId) {
        this.error = { cause };
        this.status = "error";
      }
    }
  }

  private back = () => {
    if (this.khiePairing?.cancelScan()) {
      return;
    }

    this.dispatchEvent(new Event("back", { bubbles: true, composed: true }));
  };

  static styles = css`
    :host {
      display: block;
    }
  `;
}
