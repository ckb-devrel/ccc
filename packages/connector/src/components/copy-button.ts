import { css, html, LitElement } from "lit";
import { customElement, property, state } from "lit/decorators.js";

@customElement("ccc-copy-button")
export class CopyButton extends LitElement {
  @property()
  public value?: string;

  @state()
  private isCopied = false;

  static styles = css`
    :host {
      display: flex;
      align-items: center;
      cursor: pointer;
    }
    .copy {
      width: 1em;
      height: 1em;
      fill: currentColor;
    }
    .check {
      width: 0.7em;
      height: 0.7em;
      margin-left: 0.15em;
      fill: currentColor;
    }
  `;

  updated() {
    this.dispatchEvent(new Event("updated", { bubbles: true, composed: true }));
  }

  onclick = () => {
    if (!this.value) {
      return;
    }

    this.isCopied = true;
    setTimeout(() => (this.isCopied = false), 3000);

    return window.navigator.clipboard.writeText(this.value);
  };

  render() {
    return html`
      <slot></slot>
      ${
        this.isCopied
          ? html`
              <svg class="check" viewBox="0 0 17.837 17.837" alt="copied">
                <path
                  d="M16.145,2.571c-0.272-0.273-0.718-0.273-0.99,0L6.92,10.804l-4.241-4.27c-0.272-0.274-0.715-0.274-0.989,0L0.204,8.019c-0.272,0.271-0.272,0.717,0,0.99l6.217,6.258c0.272,0.271,0.715,0.271,0.99,0L17.63,5.047c0.276-0.273,0.276-0.72,0-0.994L16.145,2.571z"
                />
              </svg>
            `
          : html`
              <svg class="copy" viewBox="0 0 24 24" alt="copy">
                <path
                  d="M19 13.5657V6.10526C19 5.49737 18.5091 5 17.9091 5H10.5454C9.94543 5 9.45452 5.49737 9.45452 6.10526V13.5657C9.45452 14.1736 9.94543 14.671 10.5454 14.671H17.9091C18.5091 14.671 19 14.1736 19 13.5657Z"
                />
                <path
                  d="M14.5455 15.8684H9.18183C8.58183 15.8684 8.09092 15.3711 8.09092 14.7632V9.329H6.09091C5.49091 9.329 5 9.82637 5 10.4343V17.8947C5 18.5026 5.49091 19 6.09091 19H13.4546C14.0546 19 14.5455 18.5026 14.5455 17.8947V15.8684Z"
                />
              </svg>
            `
      }
    `;
  }
}
