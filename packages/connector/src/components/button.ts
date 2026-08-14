import { css, LitElement } from "lit";
import { customElement, property } from "lit/decorators.js";
import { html, unsafeStatic } from "lit/static-html.js";

@customElement("ccc-button")
export class Button extends LitElement {
  @property()
  public as = "button";

  @property({ type: Boolean, reflect: true })
  public disabled = false;

  @property({ type: Boolean, reflect: true })
  public selected?: boolean;

  static styles = css`
    :host {
      width: 100%;
    }

    .control {
      background: none;
      color: inherit;
      border: none;
      padding: 0;
      font: inherit;
      cursor: pointer;
      outline: inherit;

      width: 100%;
      box-sizing: border-box;
      display: flex;
      align-items: center;
      justify-content: start;
      padding: 0.75rem 1rem;
      background: var(--btn-primary);
      border-radius: 0.4rem;
      text-align: left;
      transition: background 0.15s ease-in-out;
    }
    .control:hover,
    .control.selected {
      background: var(--btn-primary-hover);
    }
    .control:disabled {
      cursor: not-allowed;
      opacity: 0.7;
    }
    .control:disabled:hover {
      background: var(--btn-primary);
    }

    .control ::slotted(img),
    .control ::slotted(svg) {
      width: 2rem;
      height: 2rem;
      margin-right: 1rem;
      border-radius: 0.4rem;
    }
  `;

  updated() {
    this.dispatchEvent(new Event("updated", { bubbles: true, composed: true }));
  }

  render() {
    const tag = unsafeStatic(this.as);
    return html`
      <${tag}
        class="control ${this.selected ? "selected" : ""}"
        ?disabled=${this.disabled}
      >
        <slot></slot>
      </${tag}>
    `;
  }
}
