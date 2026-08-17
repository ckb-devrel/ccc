import { css, LitElement } from "lit";
import { customElement, property } from "lit/decorators.js";
import { html, unsafeStatic } from "lit/static-html.js";

@customElement("ccc-button")
export class Button extends LitElement {
  /**
   * The tag name is passed to `unsafeStatic` and must be a trusted static value,
   * never unchecked user-controlled input.
   */
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
      color: var(--btn-color, inherit);
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
      transition:
        background 0.15s ease-in-out,
        color 0.15s ease-in-out;
    }
    .control:hover,
    .control.selected {
      background: var(--btn-primary-hover);
      color: var(--btn-color-hover, var(--btn-color, inherit));
    }
    .control:disabled {
      cursor: not-allowed;
      opacity: 0.7;
    }
    .control:disabled:hover {
      background: var(--btn-primary);
      color: var(--btn-color, inherit);
    }

    .control ::slotted(img),
    .control ::slotted(svg) {
      width: 2rem;
      height: 2rem;
      margin-right: 1rem;
      border-radius: 0.4rem;
    }
    .control ::slotted(svg),
    .control ::slotted(ccc-input) {
      color: var(--btn-color, inherit) !important;
      transition: color 0.15s ease-in-out;
    }
    .control:hover ::slotted(svg),
    .control.selected ::slotted(svg),
    .control:hover ::slotted(ccc-input),
    .control.selected ::slotted(ccc-input) {
      color: var(--btn-color-hover, var(--btn-color, inherit)) !important;
    }
    .control:disabled:hover ::slotted(svg),
    .control:disabled:hover ::slotted(ccc-input) {
      color: var(--btn-color, inherit) !important;
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
