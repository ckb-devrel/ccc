import { ccc } from "@ckb-ccc/ccc";
import { LitElement, PropertyValues, css, html } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { Ref, createRef, ref } from "lit/directives/ref.js";
import {
  CloseEvent,
  ConnectedEvent,
  FeeRateSelectedEvent,
  SelectClientEvent,
} from "../events/index.js";
import { SignersController } from "../signers/index.js";
import { ClientWithFeeRate } from "./client.js";

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
  @property()
  public signersController?: ccc.SignersController;
  @state()
  public clientOptions?: { icon?: string; client: ccc.Client; name: string }[];

  private _client?: ccc.Owner<ClientWithFeeRate> = this.openDefaultClient();

  // The connector tracks the active Client through an Owner. Externally
  // supplied Clients are wrapped with a no-op disposer and remain borrowed.
  @state()
  public get client(): ccc.Client {
    if (!this._client) {
      throw new Error("Connector is not connected");
    }
    return this._client.value;
  }
  public set client(client: ccc.Client) {
    const current = this._client?.value;
    if (client === current || client === current?.[ccc.Proxy.inner]) {
      return;
    }

    this.replaceClient(
      new ccc.OwnerUnique(new ClientWithFeeRate(client), () => {}),
    );
  }

  public setClient(client: ccc.Client) {
    this.client = client;
  }

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
    if (!this._client) {
      this._client = this.openDefaultClient();
      this.requestUpdate("client");
    }
    this.loadConnection();
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    this.replaceClient();
    this.signerUpdateId += 1;
    this.unregisterSignerReplacer?.();
    this.unregisterSignerReplacer = undefined;
  }

  private openDefaultClient(): ccc.Owner<ClientWithFeeRate> {
    return ccc.ClientPublicTestnet.open().map(
      (client) => new ClientWithFeeRate(client),
    );
  }

  private replaceClient(client?: ccc.Owner<ClientWithFeeRate>): void {
    const previous = this._client;
    this._client = client;
    void previous?.dispose().catch(() => {});
  }

  willUpdate(changedProperties: PropertyValues): void {
    if (
      changedProperties.has("name") ||
      changedProperties.has("icon") ||
      changedProperties.has("client") ||
      changedProperties.has("signerFilter") ||
      changedProperties.has("preferredNetworks")
    ) {
      void this.signersControllerInner.refresh();
    }
    if (
      changedProperties.has("walletName") ||
      changedProperties.has("signerName")
    ) {
      this.refreshSigner();
    }

    this.dispatchEvent(new Event("willUpdate"));
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
    const client = this._client?.value;
    if (!client) return;

    return html`<div
      class="background"
      @click=${(event: Event) => {
        if (event.target === event.currentTarget) {
          this.onClose();
        }
      }}
      @close=${(event: CloseEvent) => {
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
                  .feeRate=${client.feeRate}
                  .clientOptions=${this.clientOptions}
                  @disconnect=${() => this.disconnect()}
                  @fee-rate-selected=${(event: FeeRateSelectedEvent) => {
                    client.feeRate = event.feeRate;
                    this.requestUpdate();
                  }}
                  @select-client=${(e: SelectClientEvent) =>
                    this.setClient(e.client)}
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
      this.dispatchEvent(new CloseEvent());
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
