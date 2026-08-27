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
      const foreground = getComputedStyle(this).color;
      const svg = encodeQR(value, "svg", { border: 1 }).replace(
        "<svg ",
        `<svg fill="${foreground}" `,
      );
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
      border-radius: 0.5rem;
      place-items: center;
    }

    img,
    span {
      display: block;
      width: 100%;
      height: 100%;
      border-radius: inherit;
    }

    img {
      object-fit: contain;
    }

    span {
      box-sizing: border-box;
      border: 1px solid var(--divider);
      background: var(--btn-primary);
    }
  `;
}
