/**
 * Every user-facing message of the connector UI as a flat key-value map.
 *
 * Naming rules:
 * - A key describes what the text means, never where it is rendered.
 * - Prefixes are stable domain nouns only (`feeRate`, `khie`, `camera`,
 *   `error`), never scene or component names.
 * - One key per meaning: identical meaning is shared, identical English with
 *   a different meaning is split.
 * - Placeholders use single braces (`{name}`) and are documented per key.
 * - Wallet and chain brand names are never translated.
 *
 * `en` is the source of truth; every built-in locale must have exactly the
 * same keys, which the compiler enforces.
 */
export interface ConnectorMessages {
  // ── Common actions / states ─────────────────────────────────────────────
  /** → "Connect" */
  connect: string;
  /** → "Disconnect" */
  disconnect: string;
  /** → "Connecting..." */
  connecting: string;
  /** → "Reconnect" */
  reconnect: string;
  /** → "Try again" */
  tryAgain: string;
  /** → "Manage" */
  manage: string;
  /** → "Copy" (screen-reader only) */
  copy: string;
  /** → "Copied" (screen-reader only) */
  copied: string;
  /** → "or" */
  or: string;
  /** → "Advanced settings" */
  advancedSettings: string;
  /** → "Powered by CCC" */
  poweredBy: string;

  // ── Wallet / chain / network ────────────────────────────────────────────
  /** → "Connect Wallet" */
  connectWallet: string;
  /** → "Select a Chain" */
  selectChain: string;
  /** → "Select Network" */
  selectNetwork: string;
  /** → "Mainnet" */
  mainnet: string;
  /** → "Testnet" */
  testnet: string;
  /** → "Confirm connection in the wallet" */
  confirmInWallet: string;
  /** `{name}` wallet or signer brand name. → "Opening {name}..." */
  openingWallet: string;
  /** `{name}` wallet or signer brand name. → "Failed to open {name}" */
  failedToOpenWallet: string;

  // ── Fee rate ────────────────────────────────────────────────────────────
  /** → "Fee Rate" */
  feeRate: string;
  /** → "Select Fee Rate" */
  selectFeeRate: string;
  /** → "Fee rate is measured in shannons per 1,000 bytes." */
  feeRateHint: string;
  /** Display label only; selection logic uses `FeeRateOptionId`. → "Auto" */
  feeRateAuto: string;
  /** Display label only; selection logic uses `FeeRateOptionId`. → "Economy" */
  feeRateEconomy: string;
  /** → "Custom" */
  feeRateCustom: string;
  /** → "Lower cost, confirmation may take longer" */
  feeRateEconomyHint: string;
  /** → "Based on recent network activity" */
  feeRateAutoHint: string;
  /** → "Loading network fee rate..." */
  feeRateLoading: string;
  /** → "shannons/KB" */
  feeRateUnit: string;

  // ── Khie pairing ────────────────────────────────────────────────────────
  /** → "Connect a Wallet via Khie" */
  khieConnectWallet: string;
  /** → "Loading Khie..." */
  khieLoading: string;
  /** → "Establishing secure connection..." */
  khieEstablishingConnection: string;
  /** → "Approve the connection in Khie to continue" */
  khieApproveInWallet: string;
  /** → "Let a wallet scan this" */
  khieLetWalletScan: string;
  /** → "Copy pairing code" */
  khieCopyPairingCode: string;
  /** → "Open Wallet" */
  khieOpenWallet: string;
  /** → "If the wallet app doesn't open, install a wallet that supports Khie or pair manually." */
  khieOpenWalletHint: string;
  /** → "Connecting relay..." */
  khieConnectingRelay: string;
  /** → "Scan wallet code" */
  khieScanWalletCode: string;
  /** → "Wallet pairing code" */
  khieWalletPairingCode: string;
  /** → "Or paste pairing code" */
  khiePastePairingCode: string;
  /**
   * Text before the help link; keep the trailing space.
   * → "Khie is a peer-to-peer protocol that connects wallets and applications. "
   */
  khieHelpIntro: string;
  /** Help link text. → "Learn more about Khie here" */
  khieHelpLink: string;
  /**
   * Text after the help link; keep the leading punctuation.
   * → ", where you can also connect a local wallet from the device where it is available."
   */
  khieHelpOutro: string;
  /** → "Relay multiaddr" */
  khieRelayMultiaddr: string;
  /** → "Connect relay" */
  khieConnectRelay: string;
  /** → "This is not a compatible Khie pairing code" */
  khieIncompatiblePairingCode: string;
  /** → "Scan a pairing code from a wallet." */
  khieIncompatiblePairingCodeHint: string;
  /** → "Go here to learn more." */
  khieLearnMore: string;

  // ── Errors raised by the connector itself ───────────────────────────────
  /** → "Unknown connection status" */
  errorUnknownConnectionStatus: string;
  /** → "Unknown browser error" */
  errorUnknownBrowser: string;
  /** → "The wallet unpaired. Go back and pair again." */
  errorKhieWalletUnpaired: string;
  /** → "Khie signer did not connect" */
  errorKhieSignerNotConnected: string;
  /** `{error}` underlying error text. → "Unable to scan pairing code: {error}" */
  errorKhieScanFailed: string;
  /** → "Camera access requires HTTPS or localhost" */
  errorCameraRequiresSecureContext: string;
  /** → "Camera access is not supported by this browser" */
  errorCameraNotSupported: string;
  /** → "Camera preview is not available" */
  errorCameraPreviewUnavailable: string;
}

export type MessageKey = keyof ConnectorMessages;

export type BuiltInConnectorLocale = "en" | "zh-CN";

/**
 * A BCP 47 language tag. Built-in locales get completion; any other tag falls
 * back to the closest registered language (`zh-HK` → `zh-CN`), then English.
 */
export type ConnectorLocale =
  BuiltInConnectorLocale | (string & Record<never, never>);
