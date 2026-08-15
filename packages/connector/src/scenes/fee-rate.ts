import { ccc } from "@ckb-ccc/ccc";
import { css, html, LitElement, PropertyValues } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { FeeRateSelectedEvent } from "../events/index.js";

type FeeRateOption = {
  description: string;
  feeRate?: ccc.Num;
  label: string;
};

const MIN_FEE_RATE = 1_000n;
const MAX_FEE_RATE = 10_000_000n;

@customElement("ccc-fee-rate-scene")
export class FeeRateScene extends LitElement {
  @property({ attribute: false })
  public client!: ccc.Client & {
    readonly [ccc.Proxy.inner]?: ccc.Client;
  };

  @property({ attribute: false })
  public feeRate?: ccc.NumLike;

  @state()
  private recommendedFeeRate?: ccc.Num;
  @state()
  private customFeeRate = "";

  private requestId = 0;

  willUpdate(changedProperties: PropertyValues<this>): void {
    if (changedProperties.has("client")) {
      void this.refreshFeeRate();
    }
    if (changedProperties.has("feeRate")) {
      const feeRate =
        this.feeRate == null ? undefined : ccc.numFrom(this.feeRate);
      const displayedFeeRate =
        feeRate == null && this.recommendedFeeRate != null
          ? this.recommendedFeeRate
          : this.isValidFeeRate(feeRate)
            ? feeRate
            : undefined;
      this.customFeeRate = displayedFeeRate?.toString() ?? "";
    }
  }

  private async refreshFeeRate() {
    const requestId = ++this.requestId;

    const feeRate = await (
      this.client[ccc.Proxy.inner] ?? this.client
    ).getFeeRate();
    if (requestId !== this.requestId) {
      return;
    }
    this.recommendedFeeRate = feeRate;
    if (
      this.feeRate == null &&
      !this.shadowRoot
        ?.querySelector(".fee-rate-input")
        ?.matches(":focus-within")
    ) {
      this.customFeeRate = feeRate.toString();
    }
  }

  private get options(): FeeRateOption[] {
    return [
      {
        label: "Economy",
        description: "Lower cost, confirmation may take longer",
        feeRate: MIN_FEE_RATE,
      },
      {
        label: "Auto",
        description:
          this.recommendedFeeRate == null
            ? "Loading network fee rate..."
            : "Based on recent network activity",
        feeRate: this.recommendedFeeRate,
      },
    ];
  }

  private selectCustomFeeRate(value: string) {
    this.customFeeRate = value;
    const feeRate = this.feeRateFromInput(value);
    if (feeRate != null) {
      this.dispatchEvent(new FeeRateSelectedEvent(feeRate));
    }
  }

  private selectCustomMode() {
    const feeRate = this.feeRateFromInput(this.customFeeRate);
    if (feeRate != null) {
      this.dispatchEvent(new FeeRateSelectedEvent(feeRate));
    }
  }

  private feeRateFromInput(value: string): ccc.Num | undefined {
    if (!/^\d+$/.test(value)) {
      return undefined;
    }
    const feeRate = ccc.numFrom(value);
    return this.isValidFeeRate(feeRate) ? feeRate : undefined;
  }

  private isValidFeeRate(feeRate: ccc.Num | undefined): feeRate is ccc.Num {
    return (
      feeRate != null && feeRate >= MIN_FEE_RATE && feeRate <= MAX_FEE_RATE
    );
  }

  private get selectedOption(): "Auto" | "Economy" | undefined {
    if (this.feeRate == null) {
      return "Auto";
    }
    return ccc.numFrom(this.feeRate) === MIN_FEE_RATE ? "Economy" : undefined;
  }

  private selectOption(label: string, feeRate: ccc.Num) {
    this.customFeeRate = feeRate.toString();
    this.dispatchEvent(
      new FeeRateSelectedEvent(label === "Auto" ? undefined : feeRate),
    );
  }

  render() {
    return html`
      <p class="tip">Fee rate is measured in shannons per 1,000 bytes.</p>

      <div class="options">
        ${this.options.map(
          ({ description, feeRate, label }) => html`
            <ccc-button
              class="fee-rate-option"
              ?selected=${this.selectedOption === label}
              ?disabled=${feeRate == null}
              @click=${() => {
                if (feeRate != null) {
                  this.selectOption(label, feeRate);
                }
              }}
            >
              <span>
                <strong>${label}</strong>
                <small>${description}</small>
              </span>
            </ccc-button>
          `,
        )}

        <label class="custom" @click=${() => this.selectCustomMode()}>
          <ccc-button
            as="div"
            class="fee-rate-option"
            ?selected=${this.selectedOption == null}
          >
            <span>
              <strong>Custom</strong>
              <small>
                ${MIN_FEE_RATE.toString()}–${MAX_FEE_RATE.toString()}
              </small>
            </span>
            <ccc-input
              class="fee-rate-input"
              inputmode="numeric"
              type="text"
              placeholder="shannons/KB"
              .value=${this.customFeeRate}
              @focus=${() => this.selectCustomMode()}
              @input=${(event: InputEvent) =>
                this.selectCustomFeeRate(
                  (event.currentTarget as HTMLElement & { value: string })
                    .value,
                )}
            ></ccc-input>
          </ccc-button>
        </label>
      </div>
    `;
  }

  updated() {
    this.dispatchEvent(new Event("updated", { bubbles: true, composed: true }));
  }

  static styles = css`
    :host {
      width: 100%;
      display: flex;
      flex-direction: column;
      align-items: center;
    }

    .tip {
      width: 100%;
      margin: 0.5rem 0;
      color: var(--tip-color);
      font-size: 0.85rem;
    }

    .options {
      width: 100%;
      display: flex;
      flex-direction: column;
      gap: 0.7rem;
    }

    .fee-rate-option > span:first-child {
      display: flex;
      flex-direction: column;
      gap: 0.2rem;
    }

    small {
      color: var(--tip-color);
      font-size: 0.75rem;
      transition: color 0.15s ease-in-out;
    }

    ccc-button:hover small,
    ccc-button[selected] small {
      color: var(--tip-color-hover, var(--tip-color));
    }

    .custom {
      display: block;
      width: 100%;
      cursor: pointer;
    }

    .custom .fee-rate-option {
      display: block;
    }

    .custom .fee-rate-option > span:first-child {
      margin-right: 1rem;
    }

    .fee-rate-input {
      width: 9rem;
      margin-left: auto;
    }
  `;
}
