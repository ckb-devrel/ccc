import { ccc } from "@ckb-ccc/ccc";
import { css, html, LitElement } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { CloseRequestEvent, ConnectedEvent } from "../../events/internal.js";
import { errorMessage } from "../error.js";
import { generateSignersScene } from "./signers.js";
import { generateWalletsScene } from "./wallets.js";

@customElement("ccc-selecting-scene")
export class SelectingScene extends LitElement {
  @property()
  public wallets?: ccc.WalletWithSigners[];

  @state()
  private selectedWallet?: ccc.WalletWithSigners;
  @state()
  private selectedSigner?: ccc.SignerInfo;
  @state()
  private connectingError?: string;

  render() {
    const [title, body] = this.renderContent();

    return html`<ccc-dialog
      header=${title}
      ?canBack=${this.selectedSigner || this.selectedWallet}
      @back=${() => {
        if (
          !this.selectedSigner ||
          (this.selectedWallet && this.selectedWallet.signers.length <= 1)
        ) {
          this.selectedWallet = undefined;
        }
        this.selectedSigner = undefined;
        this.connectingError = undefined;
      }}
    >
      ${body}
    </ccc-dialog>`;
  }

  private renderContent() {
    const wallet = this.selectedWallet;
    if (!wallet) {
      return generateWalletsScene(
        this.wallets ?? [],
        (selectedWallet) => {
          this.selectedWallet = selectedWallet;
        },
        this.signerSelectedHandler,
      );
    }

    const signer = this.selectedSigner;
    if (!signer) {
      return generateSignersScene(wallet, this.signerSelectedHandler);
    }

    return [
      wallet.name,
      html`<ccc-connecting
        .name=${wallet.name}
        .icon=${wallet.icon}
        .error=${this.connectingError}
        hint="Confirm connection in the wallet"
        .onRetry=${() => this.signerSelectedHandler(wallet, signer)}
      ></ccc-connecting>`,
    ];
  }

  public close() {
    this.selectedWallet = undefined;
    this.selectedSigner = undefined;
    this.connectingError = undefined;
  }

  private signerSelectedHandler = (
    wallet: ccc.WalletWithSigners,
    signerInfo: ccc.SignerInfo,
  ) => {
    void this.connectSigner(wallet, signerInfo);
  };

  private async connectSigner(
    wallet: ccc.WalletWithSigners,
    signerInfo: ccc.SignerInfo,
  ) {
    this.connectingError = undefined;
    this.selectedWallet = wallet;
    this.selectedSigner = signerInfo;

    const { signer } = signerInfo;
    try {
      await signer.connect();

      if (!(await signer.isConnected())) {
        this.connectingError = "Unknown connection status";
        return;
      }
    } catch (cause) {
      this.connectingError = errorMessage(cause);
      return;
    }

    this.dispatchEvent(
      new CloseRequestEvent(() => {
        this.dispatchEvent(new ConnectedEvent(wallet.name, signerInfo.name));
      }),
    );
  }

  static styles = css`
    :host {
      display: block;
    }

    .mb-1 {
      margin-bottom: 0.7rem;
    }
    .mt-1 {
      margin-top: 0.7rem;
    }

    .wallet-icon {
      width: 4rem;
      height: 4rem;
      margin-bottom: 0.5rem;
      border-radius: 0.8rem;
    }
  `;
}
