import { css, html, LitElement } from "lit";
import { customElement, property } from "lit/decorators.js";
import { RETRY_SVG } from "../assets/retry.svg.js";
import { I18n } from "../i18n/index.js";

@customElement("ccc-connecting")
export class Connecting extends LitElement {
  @property()
  public name!: string;

  @property()
  public icon!: string;

  /** Already formatted for display; see `displayError`. */
  @property()
  public error?: string;

  @property()
  public hint!: string;

  @property({ attribute: false })
  public onRetry?: () => unknown;

  @property({ attribute: false })
  public i18n = new I18n();

  render() {
    const title = this.i18n.t(
      this.error ? "failedToOpenWallet" : "openingWallet",
      { name: this.name },
    );

    return html`
      <img
        class="icon"
        src=${this.icon}
        alt=${this.name}
        referrerpolicy="no-referrer"
      />
      <span class="title">${title}</span>
      <span class="tip">${this.error ?? this.hint}</span>
      ${
        this.onRetry
          ? html`<ccc-button-pill
              class="retry"
              @click=${() => this.onRetry?.()}
            >
              ${RETRY_SVG} ${this.i18n.t("tryAgain")}
            </ccc-button-pill>`
          : undefined
      }
    `;
  }

  static styles = css`
    :host {
      display: flex;
      min-height: 15rem;
      align-items: center;
      justify-content: center;
      flex-direction: column;
      gap: 0.7rem;
    }

    .icon {
      width: 5rem;
      height: 5rem;
      margin-bottom: 0.7rem;
      border-radius: 1rem;
    }

    .title {
      font-weight: bold;
    }

    .tip {
      color: var(--tip-color);
      text-align: center;
    }

    .retry {
      margin-top: 1rem;
    }
  `;
}
