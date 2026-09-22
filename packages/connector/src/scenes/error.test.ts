import { describe, expect, it, vi } from "vitest";
import { I18n, locales } from "../i18n/index.js";
import { ConnectorError, displayError, errorMessage } from "./error.js";

describe("ConnectorError", () => {
  it("keeps the English message for logs", () => {
    const error = new ConnectorError(
      "camera-https-required",
      "Camera access requires HTTPS or localhost",
    );
    expect(errorMessage(error)).toBe(
      "Camera access requires HTTPS or localhost",
    );
  });

  it("is translated from its kind when displayed", () => {
    const error = new ConnectorError(
      "peer-unpaired",
      "The wallet unpaired. Go back and pair again.",
    );
    expect(displayError(error, new I18n())).toBe(
      locales.en.errorKhieWalletUnpaired,
    );
    expect(displayError(error, new I18n("zh-CN"))).toBe(
      locales["zh-CN"].errorKhieWalletUnpaired,
    );
  });

  it("interpolates the nested cause", () => {
    const error = new ConnectorError("scan-failed", "Unable to scan", {
      cause: new Error("NotAllowedError"),
    });
    expect(displayError(error, new I18n())).toBe(
      "Unable to scan pairing code: NotAllowedError",
    );
    expect(displayError(error, new I18n("zh-CN"))).toBe(
      "无法扫描配对码：NotAllowedError",
    );
  });

  it("unwraps ErrorEvent", () => {
    class FakeErrorEvent extends Event {
      constructor(public readonly error: unknown) {
        super("error");
      }
    }
    vi.stubGlobal("ErrorEvent", FakeErrorEvent);
    try {
      const error = new ConnectorError("camera-not-supported", "x");
      expect(displayError(new FakeErrorEvent(error), new I18n())).toBe(
        locales.en.errorCameraNotSupported,
      );
    } finally {
      vi.unstubAllGlobals();
    }
  });
});

describe("displayError", () => {
  it("shows third-party errors as-is", () => {
    expect(displayError(new Error("User rejected"), new I18n("zh-CN"))).toBe(
      "User rejected",
    );
    expect(displayError("plain string", new I18n("zh-CN"))).toBe(
      "plain string",
    );
  });

  it("translates the unknown-error fallback", () => {
    expect(displayError({}, new I18n())).toBe("Unknown browser error");
    expect(displayError({}, new I18n("zh-CN"))).toBe(
      locales["zh-CN"].errorUnknownBrowser,
    );
  });
});
