import { css, html, LitElement, PropertyValues } from "lit";
import { customElement, property, state } from "lit/decorators.js";

@customElement("ccc-qr-code")
export class QrCode extends LitElement {
  @property()
  public value = "";

  @property()
  public alt = "QR code";

  @state()
  private src = "";

  private generation = 0;

  protected updated(changed: PropertyValues<this>) {
    if (changed.has("value")) {
      void this.generate(this.value);
    }
  }

  private async generate(value: string) {
    const generation = ++this.generation;
    this.src = "";
    if (!value) {
      return;
    }

    try {
      const { default: encodeQR } = await import("qr");
      const svg = encodeQR(value, "svg", { border: 4 });
      if (generation === this.generation) {
        this.src = `data:image/svg+xml,${encodeURIComponent(svg)}`;
      }
    } catch (error) {
      if (generation === this.generation) {
        this.dispatchEvent(
          new ErrorEvent("error", { error, bubbles: true, composed: true }),
        );
      }
    }
  }

  render() {
    return this.src
      ? html`<img src=${this.src} alt=${this.alt} />`
      : html`<span aria-hidden="true"></span>`;
  }

  static styles = css`
    :host {
      display: grid;
      overflow: hidden;
      aspect-ratio: 1;
      place-items: center;
    }

    img,
    span {
      display: block;
      width: 100%;
      height: 100%;
    }

    img {
      object-fit: contain;
      background: #fff;
    }

    span {
      box-sizing: border-box;
      border: 1px solid var(--divider);
      background: var(--btn-primary);
    }
  `;
}
