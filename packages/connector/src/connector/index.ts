import { ccc } from "@ckb-ccc/ccc";
import { LitElement, PropertyValues, css, html } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { Ref, createRef, ref } from "lit/directives/ref.js";
import {
  ConnectorCloseEvent,
  ConnectorConnection,
  ConnectorConnectionEvent,
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
] as const satisfies readonly (keyof WebComponentConnector)[];

type ConnectorScene = Element & { close(): void };

@customElement("ccc-connector")
export class WebComponentConnector extends LitElement {
  constructor() {
    super();
    this.addEventListener(
      ConnectorConnectionEvent.eventName,
      this.applyConnectionEvent,
    );
  }

  @property({ attribute: "hide-mark" })
  public hideMark: unknown;
  @property()
  public name?: string;
  @property()
  public icon?: string;
  /** Default Relay multiaddr shown and used by the Khie connection flow. */
  @property({ attribute: "khie-relay-address" })
  public khieRelayAddress?: string;
  @property({ attribute: false })
  public signersController = new ccc.SignersController();
  @state()
  public clientOptions?: { icon?: string; client: ccc.Client; name: string }[];

  /** A required borrowed Client supplied by the integration layer. */
  @property({ attribute: false })
  public client!: ccc.Client;

  private signersControllerInner = new SignersController(this);

  private get appName(): string {
    return this.signersController.getConfig(this).appName;
  }

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
    const signer = this.signer?.signer;
    this.clearConnection();
    void signer?.disconnect().catch(() => {});
  }

  private clearConnection(): void {
    this.walletName = undefined;
    this.signerName = undefined;
    this.saveConnection();
    this.dispatchEvent(new ConnectorConnectionEvent());
  }

  @state()
  private pairingKhie = false;
  private connection?: ConnectorConnection;

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
    // Named selections are rebuilt by the controller refresh below. Direct
    // connections have no lookup key, so changing Client invalidates them.
    if (
      changedProperties.has("client") &&
      this.connection &&
      (!this.walletName || !this.signerName)
    ) {
      this.disconnect();
    }
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
    if (!this.walletName || !this.signerName) {
      const { signerInfo, wallet } = this.connection ?? {};
      void this.updateSigner(wallet, signerInfo);
      return;
    }

    const wallet = this.signersControllerInner.wallets.find(
      ({ name }) => name === this.walletName,
    );
    const signerInfo = wallet?.signers.find(
      ({ name }) => name === this.signerName,
    );
    void this.updateSigner(wallet, signerInfo);
  }

  private async updateSigner(
    wallet: ccc.Wallet | undefined,
    signerInfo: ccc.SignerInfo | undefined,
  ): Promise<void> {
    const updateId = ++this.signerUpdateId;
    const signerChanged = signerInfo?.signer !== this.signer?.signer;

    // A DOM detach removes the replacer subscription but keeps the borrowed
    // connection, so an unchanged signer may still need local setup restored.
    if (!signerChanged && (!signerInfo || this.unsubscribeSigner)) {
      return;
    }

    const connected = signerInfo
      ? await signerInfo.signer.isConnected()
      : false;
    if (updateId !== this.signerUpdateId) {
      return;
    }

    if (!wallet || !signerInfo || !connected) {
      if (this.connection) {
        this.dispatchEvent(new ConnectorConnectionEvent());
      }
      return;
    }

    if (!signerChanged) {
      this.unsubscribeSigner = this.subscribeSigner(signerInfo);
      return;
    }

    // The controller only discovers wallets. The Connector owns the selected
    // names and therefore produces their connection transition.
    const connection = { wallet, signerInfo };
    this.dispatchEvent(
      new ConnectorConnectionEvent(
        // Controller signers are discovered values. Releasing the selection
        // must not revoke a wallet session that a later refresh can restore.
        new ccc.OwnerUnique(connection, () => {}),
      ),
    );
  }

  private applyConnectionEvent = (event: Event): void => {
    const { connectionOwner } = event as ConnectorConnectionEvent;
    if (connectionOwner && !connectionOwner.isValid) {
      return;
    }
    const connection = connectionOwner?.value;
    this.signerUpdateId += 1;
    this.unsubscribeFromSigner();
    this.connection = connection;
    this.wallet = connection?.wallet;
    this.signer = connection?.signerInfo;
    this.unsubscribeSigner = connection
      ? this.subscribeSigner(connection.signerInfo)
      : undefined;
  };

  private unsubscribeFromSigner(): void {
    this.unsubscribeSigner?.();
    this.unsubscribeSigner = undefined;
  }

  private subscribeSigner(signerInfo: ccc.SignerInfo): () => void {
    const signer = signerInfo.signer;
    if (this.walletName && this.signerName) {
      return signer.onReplaced(() => {
        void this.signersControllerInner.refresh();
      });
    }

    return signer.onReplaced(() => {
      if (this.connection?.signerInfo.signer === signer) {
        this.clearConnection();
      }
    });
  }

  private handleKhieConnected = () => {
    this.walletName = undefined;
    this.signerName = undefined;
    this.pairingKhie = false;
    this.saveConnection();
  };

  private handleConnected = ({ walletName, signerName }: ConnectedEvent) => {
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
                      .appName=${this.appName}
                      .client=${this.client}
                      .defaultRelayAddress=${this.khieRelayAddress}
                      @back=${() => (this.pairingKhie = false)}
                      @connection=${this.handleKhieConnected}
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
