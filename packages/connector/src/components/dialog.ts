import { css, html, LitElement } from "lit";
import { customElement, property } from "lit/decorators.js";
import { CLOSE_SVG } from "../assets/close.svg.js";
import { LEFT_SVG } from "../assets/left.svg.js";
import { CloseEvent } from "../events/index.js";

@customElement("ccc-dialog")
export class Dialog extends LitElement {
  @property()
  public canBack: unknown;
  @property()
  public header?: string;

  render() {
    return html`
      <div
        class="header text-bold fs-lg ${this.header ? "header-divider" : ""}"
      >
        <div
          class="back ${this.canBack != null ? "active" : ""}"
          @click=${() => {
            this.dispatchEvent(new Event("back"));
          }}
        >
          ${LEFT_SVG}
        </div>
        ${this.header}
        <span
          class="close active"
          @click=${() => {
            this.dispatchEvent(new CloseEvent());
          }}
        >
          ${CLOSE_SVG}
        </span>
      </div>
      <div class="body">
        <slot></slot>
      </div>
    `;
  }

  static styles = css`
    .primary-icon {
      color: var(--icon-primary);
    }
    .text-bold {
      font-weight: bold;
    }

    .fs-lg {
      font-size: 1.2rem;
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

    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 1rem 1.3rem 0.5rem;
    }

    .header-divider {
      padding-bottom: 1rem;
      border-bottom: 1px solid var(--divider);
    }
    .close,
    .back {
      padding: 0.2rem 0.4rem;
      cursor: pointer;
    }
    .close svg,
    .back svg {
      width: 0.8rem;
      height: 0.8rem;
      opacity: 0;
      transition: opacity 0.15s ease-in-out;
    }

    .close.active svg,
    .back.active svg {
      opacity: 1;
    }

    .body {
      padding: 0.3rem 1.3rem 1rem;
      min-width: 20rem;
      display: flex;
      flex-direction: column;
      align-items: center;
      max-height: 80vh;
      overflow-y: auto;
    }
  `;
}
