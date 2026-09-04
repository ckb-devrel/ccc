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
  KhiePairingConnectedEvent,
} from "../events/internal.js";
import { khieWalletFrom } from "../scenes/khie/wallet.js";
import { SignersController } from "../signers/index.js";
import { ClientWithFeeRate } from "./client.js";

const SIGNER_REFRESH_PROPERTIES = [
  "name",
  "icon",
  "client",
  "signersController",
  "preferredNetworks",
] as const satisfies readonly (keyof WebComponentConnector)[];

type KhieConnection = {
  signer: ccc.SignerJsonRpc;
  signerInfo: ccc.SignerInfo;
  wallet: ccc.Wallet;
};

type ConnectorScene = Element & { close(): void };

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
  private unsubscribeSigner?: () => void;
  private signerUpdateId = 0;

  public disconnect(): void {
    const signer = this.khieConnection?.signer ?? this.signer?.signer;

    this.clearConnection();
    void signer?.disconnect().catch(() => {});
  }

  private clearConnection(): void {
    this.khieConnection = undefined;
    this.walletName = undefined;
    this.signerName = undefined;
    this.saveConnection();
    this.setSigner(undefined, undefined);
  }

  @state()
  private pairingKhie = false;
  private khieConnection?: KhieConnection;

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
    this.refreshSigner();
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    this.resizeObserver?.disconnect();
    this.resizeObserver = undefined;
    this.signerUpdateId += 1;
    this.unsubscribeFromSigner();
  }

  willUpdate(changedProperties: PropertyValues): void {
    if (
      changedProperties.has("client") &&
      !(this.client instanceof ClientWithFeeRate)
    ) {
      this.requestClientWithFeeRate();
    }
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

  private requestClientWithFeeRate(event?: FeeRateSelectedEvent): void {
    if (event) {
      event.stopPropagation();
    }

    const client = ClientWithFeeRate.from(this.client);
    client.feeRate = event?.feeRate;
    this.requestUpdate();
    this.dispatchEvent(new SelectClientEvent(client));
  }

  refreshSigner(): void {
    if (this.khieConnection) {
      const { signerInfo, wallet } = this.khieConnection;
      void this.updateSigner(wallet, signerInfo);
      return;
    }

    const wallet = this.signersControllerInner.wallets.find(
      ({ name }) => name === this.walletName,
    );
    const signer = wallet?.signers.find(({ name }) => name === this.signerName);
    void this.updateSigner(wallet, signer);
  }

  private async updateSigner(
    wallet: ccc.Wallet | undefined,
    signerInfo: ccc.SignerInfo | undefined,
  ) {
    const updateId = ++this.signerUpdateId;

    // A DOM detach removes the replacer subscription but keeps the signer, so
    // an unchanged signer still needs setup when its subscription is missing.
    if (
      signerInfo?.signer === this.signer?.signer &&
      (!signerInfo || this.unsubscribeSigner)
    ) {
      return;
    }

    const connected = signerInfo
      ? await signerInfo.signer.isConnected()
      : false;
    if (updateId !== this.signerUpdateId) {
      return;
    }

    if (signerInfo && connected) {
      this.setSigner(wallet, signerInfo);
    } else {
      this.setSigner(undefined, undefined);
    }
  }

  private setSigner(
    wallet: ccc.Wallet | undefined,
    signer: ccc.SignerInfo | undefined,
  ): void {
    this.signerUpdateId += 1;
    this.unsubscribeFromSigner();
    this.wallet = wallet;
    this.signer = signer;
    this.unsubscribeSigner = signer ? this.subscribeSigner(signer) : undefined;
  }

  private unsubscribeFromSigner(): void {
    this.unsubscribeSigner?.();
    this.unsubscribeSigner = undefined;
  }

  private subscribeSigner(signerInfo: ccc.SignerInfo): () => void {
    const signer = signerInfo.signer;
    const khieSigner = this.khieConnection?.signer;
    if (!khieSigner || signer !== khieSigner) {
      return signer.onReplaced(() => {
        void this.signersControllerInner.refresh();
      });
    }

    return khieSigner.onReplaced(() => {
      if (this.khieConnection?.signer === khieSigner) {
        this.clearConnection();
      }
    });
  }

  private handleKhieConnected = (event: KhiePairingConnectedEvent) => {
    event.stopPropagation();
    const { signer } = event;
    const wallet = khieWalletFrom(signer);
    const signerInfo = new ccc.SignerInfo(wallet.name, signer);
    this.khieConnection = { signer, signerInfo, wallet };
    this.walletName = undefined;
    this.signerName = undefined;
    this.pairingKhie = false;
    this.saveConnection();
    this.setSigner(wallet, signerInfo);
  };

  private handleConnected = ({ walletName, signerName }: ConnectedEvent) => {
    this.khieConnection = undefined;
    this.walletName = walletName;
    this.signerName = signerName;
    this.saveConnection();
    this.refreshSigner();
  };

  private readonly mainRef: Ref<HTMLDivElement> = createRef();
  private readonly contentRef: Ref<HTMLDivElement> = createRef();
  private resizeObserver?: ResizeObserver;

  render() {
    const client = this.client;
    const feeRate =
      client instanceof ClientWithFeeRate ? client.feeRate : undefined;

    return html`<div
      class="background"
      @click=${(event: Event) => {
        if (event.target === event.currentTarget) {
          this.close();
        }
      }}
      @close=${(event: CloseRequestEvent) => {
        event.stopPropagation();
        this.close(event.callback);
      }}
    >
      <div class="main" ${ref(this.mainRef)}>
        <div class="content" ${ref(this.contentRef)}>
          ${
            this.wallet && this.signer
              ? html`
                  <ccc-connected-scene
                    ?hideMark=${this.hideMark}
                    .wallet=${this.wallet}
                    .signer=${this.signer.signer}
                    .feeRate=${feeRate}
                    .clientOptions=${this.clientOptions}
                    @disconnect=${() =>
                      this.close(() => {
                        this.disconnect();
                      })}
                    @fee-rate-selected=${(event: FeeRateSelectedEvent) =>
                      this.requestClientWithFeeRate(event)}
                  ></ccc-connected-scene>
                `
              : this.pairingKhie
                ? html`
                    <ccc-khie-connect-scene
                      .client=${this.client}
                      @back=${() => (this.pairingKhie = false)}
                      @khie-pairing-connected=${this.handleKhieConnected}
                    ></ccc-khie-connect-scene>
                  `
                : html`
                    <ccc-selecting-scene
                      .wallets=${this.signersControllerInner.wallets}
                      @select-khie=${() => (this.pairingKhie = true)}
                      @connected=${this.handleConnected}
                    ></ccc-selecting-scene>
                  `
          }
        </div>
      </div>
    </div>`;
  }

  close(onClosed?: () => void) {
    if (this.mainRef.value) {
      this.mainRef.value.style.height = "0";
    }

    setTimeout(() => {
      this.dispatchEvent(new ConnectorCloseEvent());
      this.backToHome();
      onClosed?.();
    }, 150);
  }

  private backToHome(): void {
    const scene = this.contentRef.value?.firstElementChild as
      ConnectorScene | null | undefined;
    scene?.close();
    this.pairingKhie = false;
  }

  updated() {
    this.observeContent();
    this.syncHeight();
  }

  private observeContent() {
    const content = this.contentRef.value;
    if (!content || this.resizeObserver) {
      return;
    }

    this.resizeObserver = new ResizeObserver(() => this.syncHeight());
    this.resizeObserver.observe(content);
  }

  private syncHeight() {
    if (!this.mainRef.value) {
      return;
    }
    this.mainRef.value.style.height = `${
      this.contentRef.value?.clientHeight ?? 0
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

    .content {
      display: flow-root;
    }
  `;
}
