import { css, html, LitElement } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { CHECK_SVG } from "../assets/check.svg.js";

@customElement("ccc-copy-button")
export class CopyButton extends LitElement {
  @property()
  public value?: string;

  @state()
  private isCopied = false;

  connectedCallback() {
    super.connectedCallback();
    if (!this.hasAttribute("role")) {
      this.setAttribute("role", "button");
    }
    if (!this.hasAttribute("tabindex")) {
      this.tabIndex = 0;
    }
  }

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
      display: flex;
      width: 0.7em;
      height: 0.7em;
      margin-left: 0.15em;
      --check-stroke-width: 4;
    }
    .check svg {
      width: 100%;
      height: 100%;
    }
  `;

  onclick = async () => {
    if (!this.value) {
      return;
    }

    try {
      await window.navigator.clipboard.writeText(this.value);
      this.isCopied = true;
      setTimeout(() => (this.isCopied = false), 3000);
    } catch (error) {
      this.dispatchEvent(new ErrorEvent("error", { error }));
    }
  };

  onkeydown = (event: KeyboardEvent) => {
    if (event.key !== "Enter" && event.key !== " ") {
      return;
    }

    event.preventDefault();
    this.click();
  };

  render() {
    return html`
      <slot></slot>
      ${
        this.isCopied
          ? html`<span class="check" role="img" aria-label="Copied"
              >${CHECK_SVG}</span
            >`
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
