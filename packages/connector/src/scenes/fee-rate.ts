import { ccc } from "@ckb-ccc/ccc";
import { css, html, LitElement, PropertyValues } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { FeeRateSelectedEvent } from "../events/internal.js";
import { I18n } from "../i18n/index.js";

/** Stable identifier used for selection logic; never compare on `label`. */
export type FeeRateOptionId = "auto" | "economy";

type FeeRateOption = {
  id: FeeRateOptionId;
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

  @property({ attribute: false })
  public i18n = new I18n();

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
    const { t } = this;
    return [
      {
        id: "economy",
        label: t("feeRateEconomy"),
        description: t("feeRateEconomyHint"),
        feeRate: MIN_FEE_RATE,
      },
      {
        id: "auto",
        label: t("feeRateAuto"),
        description:
          this.recommendedFeeRate == null
            ? t("feeRateLoading")
            : t("feeRateAutoHint"),
        feeRate: this.recommendedFeeRate,
      },
    ];
  }

  private t: I18n["t"] = (key, vars) => this.i18n.t(key, vars);

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

  private get selectedOptionId(): FeeRateOptionId | undefined {
    if (this.feeRate == null) {
      return "auto";
    }
    return ccc.numFrom(this.feeRate) === MIN_FEE_RATE ? "economy" : undefined;
  }

  private selectOption(id: FeeRateOptionId, feeRate: ccc.Num) {
    this.customFeeRate = feeRate.toString();
    this.dispatchEvent(
      new FeeRateSelectedEvent(id === "auto" ? undefined : feeRate),
    );
  }

  render() {
    const { t } = this;
    return html`
      <p class="tip">${t("feeRateHint")}</p>

      <div class="options">
        ${this.options.map(
          ({ id, description, feeRate, label }) => html`
            <ccc-button
              class="fee-rate-option"
              ?selected=${this.selectedOptionId === id}
              ?disabled=${feeRate == null}
              @click=${() => {
                if (feeRate != null) {
                  this.selectOption(id, feeRate);
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
            ?selected=${this.selectedOptionId == null}
          >
            <span>
              <strong>${t("feeRateCustom")}</strong>
              <small>
                ${MIN_FEE_RATE.toString()}–${MAX_FEE_RATE.toString()}
              </small>
            </span>
            <ccc-input
              class="fee-rate-input"
              inputmode="numeric"
              type="text"
              placeholder=${t("feeRateUnit")}
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

    .fee-rate-input::part(input) {
      text-align: right;
    }
  `;
}
