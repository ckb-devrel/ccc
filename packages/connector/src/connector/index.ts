import { ccc } from "@ckb-ccc/ccc";
import { LitElement, PropertyValues, css, html } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { Ref, createRef, ref } from "lit/directives/ref.js";
import {
  ConnectorCloseEvent,
  ConnectorWillUpdateEvent,
  SelectClientEvent,
} from "../events/external.js";
import {
  CloseRequestEvent,
  ConnectedEvent,
  FeeRateSelectedEvent,
} from "../events/internal.js";
import { SignersController } from "../signers/index.js";
import { ClientWithFeeRate } from "./client.js";

const SIGNER_REFRESH_PROPERTIES = [
  "name",
  "icon",
  "client",
  "signersController",
  "preferredNetworks",
] as const satisfies readonly (keyof WebComponentConnector)[];

@customElement("ccc-connector")
export class WebComponentConnector extends LitElement {
  @property()
  public hideMark: unknown;
  @property()
  public name?: string;
  @property()
  public icon?: string;
  /** @deprecated This compatibility property is ignored. */
  @property()
  public preferredNetworks?: ccc.NetworkPreference[];
  @property({ attribute: false })
  public signersController = new ccc.SignersController();
  @state()
  public clientOptions?: { icon?: string; client: ccc.Client; name: string }[];

  /** A required borrowed Client supplied by the integration layer. */
  @property({ attribute: false })
  public client!: ccc.Client;

  private signersControllerInner = new SignersController(this);

  @state()
  private walletName?: string;
  @state()
  private signerName?: string;
  @state()
  public wallet?: ccc.Wallet;
  @state()
  public signer?: ccc.SignerInfo;
  @state()
  private unregisterSignerReplacer?: () => void;
  private signerUpdateId = 0;

  public disconnect() {
    this.onClose(() => {
      this.walletName = undefined;
      this.signerName = undefined;
      this.saveConnection();
      void this.signer?.signer.disconnect();
    });
  }

  private loadConnection() {
    const { signerName, walletName } = JSON.parse(
      window.localStorage.getItem("ccc-connection-info") ?? "{}",
    ) as { signerName?: string; walletName?: string };

    this.signerName = signerName;
    this.walletName = walletName;
  }

  private saveConnection() {
    window.localStorage.setItem(
      "ccc-connection-info",
      JSON.stringify({
        signerName: this.signerName,
        walletName: this.walletName,
      }),
    );
  }

  connectedCallback(): void {
    super.connectedCallback();
    this.loadConnection();
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    this.signerUpdateId += 1;
    this.unregisterSignerReplacer?.();
    this.unregisterSignerReplacer = undefined;
  }

  willUpdate(changedProperties: PropertyValues): void {
    if (
      SIGNER_REFRESH_PROPERTIES.some((property) =>
        changedProperties.has(property),
      )
    ) {
      void this.signersControllerInner.refresh();
    }
    if (
      changedProperties.has("walletName") ||
      changedProperties.has("signerName")
    ) {
      this.refreshSigner();
    }

    this.dispatchEvent(new ConnectorWillUpdateEvent());
  }

  private requestClientWithFeeRate(event: FeeRateSelectedEvent): void {
    event.stopPropagation();

    const current = this.client;
    const client =
      current instanceof ClientWithFeeRate
        ? current
        : new ClientWithFeeRate(current);
    client.feeRate = event.feeRate;
    this.requestUpdate();
    this.dispatchEvent(new SelectClientEvent(client));
  }

  refreshSigner() {
    const wallet = this.signersControllerInner.wallets.find(
      ({ name }) => name === this.walletName,
    );
    const signer = wallet?.signers.find(({ name }) => name === this.signerName);
    void this.updateSigner(wallet, signer);
  }

  async updateSigner(
    wallet: ccc.Wallet | undefined,
    signerInfo: ccc.SignerInfo | undefined,
  ) {
    const updateId = ++this.signerUpdateId;

    if (signerInfo?.signer === this.signer?.signer) {
      return;
    }

    const connected = signerInfo
      ? await signerInfo.signer.isConnected()
      : false;
    if (updateId !== this.signerUpdateId) {
      return;
    }

    this.unregisterSignerReplacer?.();
    this.unregisterSignerReplacer = undefined;

    if (signerInfo && connected) {
      this.wallet = wallet;
      this.signer = signerInfo;
      this.unregisterSignerReplacer = signerInfo.signer.onReplaced(() => {
        void this.signersControllerInner.refresh();
      });
    } else {
      this.wallet = undefined;
      this.signer = undefined;
    }
  }

  private readonly mainRef: Ref<HTMLDivElement> = createRef();
  private readonly bodyRef: Ref<HTMLDivElement & { onClose?: () => void }> =
    createRef();

  render() {
    const client = this.client;
    const feeRate =
      client instanceof ClientWithFeeRate ? client.feeRate : undefined;

    return html`<div
      class="background"
      @click=${(event: Event) => {
        if (event.target === event.currentTarget) {
          this.onClose();
        }
      }}
      @close=${(event: CloseRequestEvent) => {
        event.stopPropagation();
        this.onClose(event.callback);
      }}
      @updated=${() => this.updated()}
    >
      <div class="main" ${ref(this.mainRef)}>
        ${
          this.wallet && this.signer
            ? html`
                <ccc-connected-scene
                  ?hideMark=${this.hideMark}
                  .wallet=${this.wallet}
                  .signer=${this.signer.signer}
                  .feeRate=${feeRate}
                  .clientOptions=${this.clientOptions}
                  @disconnect=${() => this.disconnect()}
                  @fee-rate-selected=${(event: FeeRateSelectedEvent) =>
                    this.requestClientWithFeeRate(event)}
                  ${ref(this.bodyRef)}
                ></ccc-connected-scene>
              `
            : html`
                <ccc-selecting-scene
                  .wallets=${this.signersControllerInner.wallets}
                  @connected=${({ walletName, signerName }: ConnectedEvent) => {
                    this.walletName = walletName;
                    this.signerName = signerName;
                    this.refreshSigner();
                    this.saveConnection();
                  }}
                  ${ref(this.bodyRef)}
                ></ccc-selecting-scene>
              `
        }
      </div>
    </div>`;
  }

  onClose(onClosed?: () => void) {
    if (this.mainRef.value) {
      this.mainRef.value.style.height = "0";
    }

    setTimeout(() => {
      this.dispatchEvent(new ConnectorCloseEvent());
      this.bodyRef.value?.onClose?.();
      onClosed?.();
    }, 150);
  }

  updated() {
    if (!this.mainRef.value) {
      return;
    }
    this.mainRef.value.style.height = `${
      this.bodyRef.value?.clientHeight ?? 0
    }px`;
  }

  static styles = css`
    :host {
      width: 100vw;
      height: 100vh;
      position: fixed;
      left: 0;
      top: 0;
    }

    .background {
      width: 100%;
      height: 100%;
      background: rgba(18, 19, 24, 0.7);
    }

    .main {
      position: fixed;
      left: 50%;
      top: 50%;
      transform: translate(-50%, -50%);
      background: var(--background);
      border-radius: 1.2rem;
      overflow: hidden;
      transition: height 0.15s ease-out;
    }
  `;
}
