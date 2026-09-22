import type { ConnectorMessages } from "../types.js";

/** Source of truth. Every other locale must have exactly the same keys. */
export const en: ConnectorMessages = {
  // Common actions / states
  connect: "Connect",
  disconnect: "Disconnect",
  connecting: "Connecting...",
  reconnect: "Reconnect",
  tryAgain: "Try again",
  manage: "Manage",
  copy: "Copy",
  copied: "Copied",
  or: "or",
  advancedSettings: "Advanced settings",
  poweredBy: "Powered by CCC",

  // Wallet / chain / network
  connectWallet: "Connect Wallet",
  selectChain: "Select a Chain",
  selectNetwork: "Select Network",
  mainnet: "Mainnet",
  testnet: "Testnet",
  confirmInWallet: "Confirm connection in the wallet",
  openingWallet: "Opening {name}...",
  failedToOpenWallet: "Failed to open {name}",

  // Fee rate
  feeRate: "Fee Rate",
  selectFeeRate: "Select Fee Rate",
  feeRateHint: "Fee rate is measured in shannons per 1,000 bytes.",
  feeRateAuto: "Auto",
  feeRateEconomy: "Economy",
  feeRateCustom: "Custom",
  feeRateEconomyHint: "Lower cost, confirmation may take longer",
  feeRateAutoHint: "Based on recent network activity",
  feeRateLoading: "Loading network fee rate...",
  feeRateUnit: "shannons/KB",

  // Khie pairing
  khieConnectWallet: "Connect a Wallet via Khie",
  khieLoading: "Loading Khie...",
  khieEstablishingConnection: "Establishing secure connection...",
  khieApproveInWallet: "Approve the connection in Khie to continue",
  khieLetWalletScan: "Let a wallet scan this",
  khieConnectorPairingCode: "Connector pairing code",
  khieCopyPairingCode: "Tap to copy pairing code",
  khieCopyConnectorPairingCode: "Copy connector pairing code",
  khieOpenWallet: "Open Wallet",
  khieOpenWalletHint:
    "If the wallet app doesn't open, install a wallet that supports Khie or pair manually.",
  khieConnectingRelay: "Connecting relay...",
  khieScanWalletCode: "Scan wallet code",
  khieWalletPairingCode: "Wallet pairing code",
  khiePastePairingCode: "Or paste pairing code",
  khieHelpIntro:
    "Khie is a peer-to-peer protocol that connects wallets and applications. ",
  khieHelpLink: "Learn more about Khie here",
  khieHelpOutro:
    ", where you can also connect a local wallet from the device where it is available.",
  khieRelayMultiaddr: "Relay multiaddr",
  khieConnectRelay: "Connect relay",
  khieIncompatiblePairingCode: "This is not a compatible Khie pairing code",
  khieIncompatiblePairingCodeHint: "Scan a pairing code from a wallet.",
  khieLearnMore: "Go here to learn more.",

  // Errors raised by the connector itself
  errorUnknownConnectionStatus: "Unknown connection status",
  errorUnknownBrowser: "Unknown browser error",
  errorKhieWalletUnpaired: "The wallet unpaired. Go back and pair again.",
  errorKhieSignerNotConnected: "Khie signer did not connect",
  errorKhieScanFailed: "Unable to scan pairing code: {error}",
  errorCameraRequiresSecureContext: "Camera access requires HTTPS or localhost",
  errorCameraNotSupported: "Camera access is not supported by this browser",
  errorCameraPreviewUnavailable: "Camera preview is not available",
};
