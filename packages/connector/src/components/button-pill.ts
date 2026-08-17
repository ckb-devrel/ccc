import { css, html, LitElement } from "lit";
import { customElement } from "lit/decorators.js";

@customElement("ccc-button-pill")
export class ButtonPill extends LitElement {
  static styles = css`
    button {
      background: none;
      color: var(--btn-color, inherit);
      border: none;
      padding: 0;
      font: inherit;
      cursor: pointer;
      outline: inherit;

      width: 100%;
      display: flex;
      align-items: center;
      padding: 0.25rem 1rem;
      background: var(--btn-secondary);
      border-radius: 9999px;
      transition:
        background 0.15s ease-in-out,
        color 0.15s ease-in-out;
    }
    button:hover {
      background: var(--btn-secondary-hover);
      color: var(--btn-color-hover, var(--btn-color, inherit));
    }
    button:disabled {
      cursor: not-allowed;
    }
    button:disabled:hover {
      background: var(--btn-secondary);
      color: var(--btn-color, inherit);
    }

    button ::slotted(img),
    button ::slotted(svg) {
      width: 0.8rem;
      height: 0.8rem;
      margin-right: 0.5rem;
    }
    button ::slotted(svg) {
      color: var(--btn-color, inherit) !important;
      transition: color 0.15s ease-in-out;
    }
    button:hover ::slotted(svg) {
      color: var(--btn-color-hover, var(--btn-color, inherit)) !important;
    }
    button:disabled:hover ::slotted(svg) {
      color: var(--btn-color, inherit) !important;
    }
  `;

  updated() {
    this.dispatchEvent(new Event("updated", { bubbles: true, composed: true }));
  }

  render() {
    return html`<button><slot></slot></button>`;
  }
}
