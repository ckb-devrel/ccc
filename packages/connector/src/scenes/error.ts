import type { I18n, MessageKey } from "../i18n/index.js";

export type ConnectorErrorKind =
  | "unknown-connection-status"
  | "peer-unpaired"
  | "signer-not-connected"
  | "camera-https-required"
  | "camera-not-supported"
  | "camera-preview-unavailable"
  | "scan-failed";

const CONNECTOR_ERROR_MESSAGE_KEYS = {
  "unknown-connection-status": "errorUnknownConnectionStatus",
  "peer-unpaired": "errorKhieWalletUnpaired",
  "signer-not-connected": "errorKhieSignerNotConnected",
  "camera-https-required": "errorCameraRequiresSecureContext",
  "camera-not-supported": "errorCameraNotSupported",
  "camera-preview-unavailable": "errorCameraPreviewUnavailable",
  "scan-failed": "errorKhieScanFailed",
} as const satisfies Record<ConnectorErrorKind, MessageKey>;

/**
 * An error raised by the connector itself that is shown to the user.
 *
 * `message` stays English so logs and non-UI consumers keep working; the UI
 * translates from `kind` at render time so it follows locale switches.
 */
export class ConnectorError extends Error {
  constructor(
    public readonly kind: ConnectorErrorKind,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = "ConnectorError";
  }
}

export function errorMessage(
  cause: unknown,
  fallback = "Unknown browser error",
): string {
  if (cause instanceof ConnectorError) {
    return cause.message;
  }

  if (cause instanceof Error) {
    const message = cause.message || cause.name;
    return cause.name && cause.name !== "Error"
      ? `${cause.name}: ${message}`
      : message;
  }

  if (typeof cause === "string") {
    return cause;
  }

  if (
    typeof ErrorEvent !== "undefined" &&
    cause instanceof ErrorEvent &&
    cause.error !== undefined
  ) {
    return errorMessage(cause.error, fallback);
  }

  if (typeof cause === "object" && cause !== null) {
    if (
      "message" in cause &&
      typeof cause.message === "string" &&
      cause.message
    ) {
      const name =
        "name" in cause && typeof cause.name === "string" ? cause.name : "";
      return name ? `${name}: ${cause.message}` : cause.message;
    }

    try {
      const serialized = JSON.stringify(cause);
      if (serialized && serialized !== "{}") {
        return serialized;
      }
    } catch {
      // Fall through to the browser's string representation.
    }
  }

  const message = String(cause);
  return message && message !== "[object Object]" ? message : fallback;
}

/**
 * Message to display for an error. Connector errors are translated; errors
 * from wallet extensions and other third parties are shown as-is.
 */
export function displayError(cause: unknown, i18n: I18n): string {
  if (cause instanceof ConnectorError) {
    return i18n.t(CONNECTOR_ERROR_MESSAGE_KEYS[cause.kind], {
      error: cause.cause === undefined ? "" : displayError(cause.cause, i18n),
    });
  }

  if (
    typeof ErrorEvent !== "undefined" &&
    cause instanceof ErrorEvent &&
    cause.error !== undefined
  ) {
    return displayError(cause.error, i18n);
  }

  return errorMessage(cause, i18n.t("errorUnknownBrowser"));
}
