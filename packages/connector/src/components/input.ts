import { css, html, LitElement } from "lit";
import { customElement, property } from "lit/decorators.js";
import { ifDefined } from "lit/directives/if-defined.js";

@customElement("ccc-input")
export class Input extends LitElement {
  @property()
  public inputmode?: string;

  @property()
  public placeholder?: string;

  @property()
  public type = "text";

  @property({ attribute: false })
  public value = "";

  render() {
    return html`
      <input
        inputmode=${ifDefined(this.inputmode)}
        placeholder=${ifDefined(this.placeholder)}
        type=${this.type}
        .value=${this.value}
        @input=${(event: InputEvent) => {
          this.value = (event.currentTarget as HTMLInputElement).value;
        }}
      />
    `;
  }

  static styles = css`
    :host {
      display: block;
    }

    input {
      box-sizing: border-box;
      width: 100%;
      padding: 0.55rem 0.65rem;
      border: none;
      border-radius: 0.35rem;
      background: var(--background);
      color: inherit;
      font: inherit;
      text-align: right;
      outline: none;
      cursor: text;
    }
  `;
}
