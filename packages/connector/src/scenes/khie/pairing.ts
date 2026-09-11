import { ccc } from "@ckb-ccc/ccc";
import { css, html, LitElement } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { CHECK_SVG } from "../../assets/check.svg.js";
import { LEFT_SVG } from "../../assets/left.svg.js";
import { RETRY_SVG } from "../../assets/retry.svg.js";
import { SCAN_SVG } from "../../assets/scan.svg.js";
import type { QrScannedEvent } from "../../components/qr-scanner.js";
import { ConnectorConnectionEvent } from "../../events/external.js";
import { CloseRequestEvent } from "../../events/internal.js";
import { errorMessage } from "../error.js";
import { DEFAULT_RELAY_ADDRESS } from "./node.js";
import { KhiePairingSession } from "./session.js";
import { KHIE_WALLET_NAME, khieSignerIcon } from "./wallet.js";

@customElement("ccc-khie-pairing")
export class KhiePairing extends LitElement {
  @property({ attribute: false })
  public appName?: string;

  @property({ attribute: false })
  public client!: ccc.Client;

  @state()
  private relayAddress = DEFAULT_RELAY_ADDRESS;
  @state()
  private isAdvancedSettingsOpen = false;
  @state()
  private khieEndpoint = "";
  @state()
  private isScanning = false;
  @state()
  private localError?: string;

  private session!: KhiePairingSession;

  connectedCallback() {
    super.connectedCallback();
    this.localError = undefined;

    this.session = new KhiePairingSession({
      name: this.appName,
      client: this.client,
      onConnected: (connectionOwner) => {
        this.dispatchEvent(
          new CloseRequestEvent(() => {
            if (!connectionOwner.isValid) {
              return;
            }
            try {
              this.dispatchEvent(new ConnectorConnectionEvent(connectionOwner));
            } finally {
              void connectionOwner.dispose().catch(() => {});
            }
          }),
        );
      },
      onStateChange: () => {
        if (this.session.state.phase !== "idle") {
          this.localError = undefined;
        }
        this.requestUpdate();
      },
    });
    void this.session.start(this.relayAddress.trim());
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    void this.session.close();
  }

  public close() {
    this.isScanning = false;
    void this.session.close();
  }

  public cancelScan() {
    if (!this.isScanning) {
      return false;
    }

    this.isScanning = false;
    return true;
  }

  private async pair() {
    const endpoint = this.khieEndpoint.trim();
    if (!endpoint) {
      return;
    }

    this.localError = undefined;
    if (await this.session.pair(endpoint)) {
      this.khieEndpoint = "";
    }
  }

  private startScanner() {
    this.isScanning = true;
    this.localError = undefined;
  }

  private connectRelay() {
    void this.session.connectRelay(this.relayAddress.trim());
  }

  private qrScanned = (event: QrScannedEvent) => {
    this.khieEndpoint = event.value.trim();
    this.isScanning = false;
    void this.pair();
  };

  private scannerError = (event: ErrorEvent) => {
    this.localError = `Unable to scan pairing code: ${errorMessage(event.error)}`;
    this.isScanning = false;
  };

  render() {
    const {
      canPair,
      error: sessionError,
      errorKind,
      ownEndpoint,
      phase,
      relayState,
      signer,
    } = this.session.state;
    const error = this.localError ?? sessionError;

    if (phase === "pairing" || phase === "connecting") {
      return html`<ccc-connecting
        .name=${signer?.name ?? KHIE_WALLET_NAME}
        .icon=${khieSignerIcon(signer?.icon)}
        .error=${error}
        .hint=${
          signer
            ? "Approve the connection in Khie to continue"
            : "Establishing secure connection…"
        }
        .onRetry=${
          signer
            ? () => {
                void this.session.retrySigner();
              }
            : undefined
        }
      ></ccc-connecting>`;
    }

    if (this.isScanning) {
      return html`<ccc-qr-scanner
        @qr-scanned=${this.qrScanned}
        @error=${this.scannerError}
      ></ccc-qr-scanner>`;
    }

    return html`
      <div class="pairing-layout">
        <section class="field pairing-side own-side">
          <label>Let a wallet scan this</label>
          <div class="endpoint-pair">
            <ccc-qr-code
              class="qr-code"
              .value=${ownEndpoint}
              alt="Connector pairing code"
              @error=${(event: ErrorEvent) => {
                this.localError = errorMessage(event.error);
              }}
            ></ccc-qr-code>
            ${
              relayState === "failed"
                ? html`<ccc-button-pill @click=${() => this.connectRelay()}>
                    ${RETRY_SVG} Try again
                  </ccc-button-pill>`
                : ownEndpoint
                  ? html`<ccc-copy-button
                      .value=${ownEndpoint}
                      class="endpoint-copy"
                      title="Copy pairing code"
                      aria-label="Copy connector pairing code"
                      @error=${(event: ErrorEvent) => {
                        this.localError = errorMessage(event.error);
                      }}
                    >
                      <span>${ownEndpoint}</span>
                    </ccc-copy-button>`
                  : html`<span class="endpoint-pending"
                      >Connecting relay…</span
                    >`
            }
          </div>
        </section>

        <div class="divider" aria-hidden="true"><span>or</span></div>

        <section class="field pairing-side remote-side">
          <label>Scan wallet code</label>
          <div class="remote-actions">
            <ccc-button @click=${() => this.startScanner()}>
              ${SCAN_SVG} Scan wallet code
            </ccc-button>
            <div class="endpoint-control">
              <ccc-input
                class="endpoint-input"
                .value=${this.khieEndpoint}
                aria-label="Wallet pairing code"
                placeholder="Or paste pairing code"
                spellcheck="false"
                @input=${(event: InputEvent) => {
                  this.khieEndpoint = (
                    event.currentTarget as HTMLElement & { value: string }
                  ).value;
                }}
                @keydown=${(event: KeyboardEvent) => {
                  if (event.key === "Enter") {
                    void this.pair();
                  }
                }}
              ></ccc-input>
              <button
                class="endpoint-submit"
                aria-label="Connect"
                title="Connect"
                ?disabled=${!canPair || !this.khieEndpoint.trim()}
                @click=${() => this.pair()}
              >
                ${CHECK_SVG}
              </button>
            </div>
          </div>

          <button
            class="text-button advanced-toggle"
            aria-expanded=${this.isAdvancedSettingsOpen}
            aria-controls="khie-advanced-settings"
            @click=${() => {
              this.isAdvancedSettingsOpen = !this.isAdvancedSettingsOpen;
            }}
          >
            <span>Advanced settings</span>
            <span class="settings-chevron">${LEFT_SVG}</span>
          </button>
        </section>

        ${
          this.isAdvancedSettingsOpen
            ? html`<section
                class="field advanced-settings"
                id="khie-advanced-settings"
              >
                <label>Relay multiaddr</label>
                <div class="relay-control">
                  <ccc-input
                    class="relay-input"
                    .value=${this.relayAddress}
                    aria-label="Relay multiaddr"
                    placeholder="/dns4/relay.example/tcp/443/wss"
                    spellcheck="false"
                    @input=${(event: InputEvent) => {
                      this.relayAddress = (
                        event.currentTarget as HTMLElement & { value: string }
                      ).value;
                    }}
                  ></ccc-input>
                  <button
                    ?disabled=${
                      !canPair ||
                      !this.relayAddress.trim() ||
                      relayState === "connecting"
                    }
                    @click=${() => this.connectRelay()}
                  >
                    ${
                      relayState === "connecting"
                        ? "Connecting…"
                        : relayState === "connected"
                          ? "Reconnect"
                          : "Connect relay"
                    }
                  </button>
                </div>
              </section>`
            : undefined
        }
      </div>
      ${
        error && !this.localError && errorKind === "incompatible-peer"
          ? html`<div class="compatibility-help" role="alert">
              <strong>This is not a compatible Khie pairing code</strong>
              <span>
                Scan a pairing code from a wallet.
                ${
                  this.khieEndpoint
                    ? html`<a
                        href=${this.khieEndpoint}
                        target="_blank"
                        rel="noopener noreferrer"
                        >Go here to learn more.</a
                      >`
                    : undefined
                }
              </span>
            </div>`
          : undefined
      }
      ${
        error && (this.localError || errorKind !== "incompatible-peer")
          ? html`<span class="error">${error}</span>`
          : undefined
      }
    `;
  }

  static styles = css`
    :host {
      display: flex;
      width: min(44rem, calc(100vw - 4rem));
      flex-direction: column;
      gap: 1rem;
    }

    .pairing-layout {
      display: grid;
      min-width: 0;
      grid-template-columns: minmax(0, 1fr) 2.25rem minmax(0, 1fr);
      gap: 1rem;
    }

    .field {
      display: flex;
      min-width: 0;
      flex-direction: column;
      gap: 0.5rem;
    }

    label {
      font-size: 0.85rem;
      font-weight: 600;
    }

    .pairing-side {
      min-height: 17.5rem;
    }

    .own-side {
      grid-row: 1;
      grid-column: 1;
    }

    .remote-side {
      display: grid;
      grid-row: 1;
      grid-column: 3;
      grid-template-rows: auto minmax(0, 1fr) auto;
    }

    button {
      box-sizing: border-box;
      padding: 0.65rem 0.85rem;
      border: 1px solid var(--divider);
      border-radius: 0.4rem;
      color: var(--btn-color, inherit);
      background: var(--btn-primary);
      font: inherit;
      cursor: pointer;
    }

    button:hover:not(:disabled) {
      color: var(--btn-color-hover, var(--btn-color, inherit));
      background: var(--btn-primary-hover);
    }

    button:disabled {
      cursor: not-allowed;
      opacity: 0.55;
    }

    .endpoint-input {
      min-width: 0;
      height: 2.7rem;
    }

    .endpoint-pair {
      display: grid;
      min-width: 0;
      justify-items: center;
      gap: 0.75rem;
    }

    .qr-code {
      width: min(13rem, 100%);
    }

    .endpoint-copy,
    .endpoint-pending {
      box-sizing: border-box;
      width: 100%;
      min-height: 2.7rem;
    }

    .endpoint-copy {
      display: grid;
      min-width: 0;
      padding: 0.65rem 0.85rem;
      align-items: center;
      color: var(--btn-color, inherit);
      cursor: pointer;
      grid-template-columns: minmax(0, 1fr) auto;
      gap: 0.7rem;
      text-align: left;
      transition: color 0.15s ease-in-out;
    }

    .endpoint-copy:hover {
      color: var(--btn-color-hover, var(--btn-color, inherit));
    }

    .endpoint-copy span {
      overflow: hidden;
      font-family: monospace;
      font-size: 0.72rem;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .endpoint-pending {
      display: flex;
      padding: 0.65rem 0.85rem;
      align-items: center;
      justify-content: center;
      color: var(--tip-color);
      font-size: 0.8rem;
    }

    .divider {
      position: relative;
      display: grid;
      grid-row: 1;
      grid-column: 2;
      color: var(--tip-color);
      font-size: 0.7rem;
      place-items: center;
      text-transform: uppercase;
    }

    .divider::before {
      position: absolute;
      top: 0;
      bottom: 0;
      left: 50%;
      width: 1px;
      background: var(--divider);
      content: "";
    }

    .divider span {
      z-index: 1;
      padding: 0.5rem 0.25rem;
      background: var(--background);
    }

    .remote-actions {
      display: grid;
      align-content: center;
      gap: 0.5rem;
    }

    .endpoint-control,
    .relay-control {
      display: grid;
      min-width: 0;
      grid-template-columns: minmax(0, 1fr) auto;
    }

    .endpoint-control {
      overflow: hidden;
      border: 1px solid var(--divider);
      border-radius: 0.4rem;
    }

    .endpoint-control:focus-within {
      border-color: var(--tip-color-hover, var(--tip-color));
    }

    .endpoint-input::part(input) {
      height: 100%;
      padding: 0.65rem;
      border: 0;
      border-radius: 0;
    }

    .endpoint-submit {
      display: grid;
      width: 2.7rem;
      height: 2.7rem;
      padding: 0;
      border: 0;
      border-radius: 0;
      color: var(--btn-color-hover, var(--btn-color, inherit));
      background: transparent;
      place-items: center;
    }

    .endpoint-submit:hover:not(:disabled) {
      background: transparent;
    }

    .endpoint-submit:disabled {
      color: var(--divider);
      opacity: 1;
    }

    .endpoint-submit svg {
      width: 1.3rem;
      height: 1.3rem;
    }

    .text-button {
      padding: 0;
      border: 0;
      color: var(--tip-color);
      background: transparent;
      font-size: 0.72rem;
    }

    .text-button:hover:not(:disabled) {
      color: var(--tip-color-hover, var(--tip-color));
      background: transparent;
    }

    .advanced-toggle {
      display: flex;
      align-items: center;
      justify-self: end;
      gap: 0.3rem;
    }

    .settings-chevron {
      display: grid;
      transform: rotate(-90deg);
      transition: transform 0.15s ease-in-out;
      --left-stroke-width: 2.5;
    }

    .settings-chevron svg {
      width: 0.65rem;
      height: 0.65rem;
    }

    .advanced-toggle[aria-expanded="true"] .settings-chevron {
      transform: rotate(90deg);
    }

    .advanced-settings {
      grid-row: 2;
      grid-column: 1 / -1;
      animation: advanced-settings-enter 0.2s ease-out both;
    }

    .relay-control {
      gap: 0.5rem;
    }

    .relay-input {
      min-width: 0;
      height: 100%;
    }

    .relay-input::part(input) {
      height: 100%;
      padding: 0.65rem;
      border-color: var(--divider);
      border-radius: 0.4rem;
    }

    .relay-control button {
      white-space: nowrap;
    }

    @keyframes advanced-settings-enter {
      from {
        opacity: 0;
        transform: translateY(-0.35rem);
      }
    }

    .error {
      display: block;
      color: var(--tip-color);
      font-size: 0.8rem;
      text-align: center;
    }

    .compatibility-help {
      display: grid;
      padding: 0.8rem 0.9rem;
      border: 1px solid var(--divider);
      border-radius: 0.4rem;
      gap: 0.3rem;
    }

    .compatibility-help strong {
      font-size: 0.85rem;
    }

    .compatibility-help span {
      color: var(--tip-color);
      font-size: 0.78rem;
      line-height: 1.45;
    }

    .compatibility-help a {
      color: inherit;
      text-decoration: underline;
      text-underline-offset: 0.15em;
    }

    @media (max-width: 40rem) {
      :host {
        width: min(28rem, calc(100vw - 4rem));
      }

      .qr-code {
        /* I hate Apple */
        width: min(22rem, calc(100% - 1.5rem));
        height: min(22rem, calc(100vw - 5.5rem));
      }

      .pairing-layout {
        grid-template-columns: minmax(0, 1fr);
      }

      .divider {
        height: 1.25rem;
        grid-row: 2;
        grid-column: 1;
      }

      .divider::before {
        top: 50%;
        right: 0;
        bottom: auto;
        left: 0;
        width: auto;
        height: 1px;
      }

      .divider span {
        padding: 0.25rem 0.5rem;
      }

      .remote-side {
        min-height: 11rem;
        grid-row: 3;
        grid-column: 1;
      }

      .advanced-settings {
        grid-row: 4;
      }
    }
  `;
}
