import { describe, expect, it } from "vitest";
import { I18n, interpolate, locales, resolveLocale } from "./index.js";
import type { MessageKey } from "./types.js";

const messageKeys = Object.keys(locales.en) as MessageKey[];

describe("locales", () => {
  it("every built-in locale has exactly the keys of en", () => {
    const expected = [...messageKeys].sort();
    for (const [name, messages] of Object.entries(locales)) {
      expect(Object.keys(messages).sort(), name).toEqual(expected);
    }
  });

  it("no built-in locale has an empty message", () => {
    for (const [name, messages] of Object.entries(locales)) {
      for (const key of messageKeys) {
        expect(messages[key], `${name}:${key}`).not.toBe("");
      }
    }
  });

  it("every locale keeps the placeholders of en", () => {
    const placeholders = (text: string) =>
      (text.match(/\{\w+\}/g) ?? []).sort();
    for (const [name, messages] of Object.entries(locales)) {
      for (const key of messageKeys) {
        expect(placeholders(messages[key]), `${name}:${key}`).toEqual(
          placeholders(locales.en[key]),
        );
      }
    }
  });
});

describe("resolveLocale", () => {
  it("matches exact and case-insensitive tags", () => {
    expect(resolveLocale("zh-CN")).toBe(locales["zh-CN"]);
    expect(resolveLocale("zh-cn")).toBe(locales["zh-CN"]);
  });

  it("falls back to a registered locale of the same language", () => {
    expect(resolveLocale("zh")).toBe(locales["zh-CN"]);
    expect(resolveLocale("zh-HK")).toBe(locales["zh-CN"]);
    expect(resolveLocale("zh_TW")).toBe(locales["zh-CN"]);
    expect(resolveLocale("en-US")).toBe(locales.en);
  });

  it("falls back to English for unknown languages", () => {
    expect(resolveLocale("vi-VN")).toBe(locales.en);
  });
});

describe("interpolate", () => {
  it("replaces known placeholders and keeps unknown ones", () => {
    expect(interpolate("Opening {name}... {other}", { name: "JoyID" })).toBe(
      "Opening JoyID... {other}",
    );
    expect(interpolate("{n} items", { n: 3 })).toBe("3 items");
  });
});

describe("I18n", () => {
  it("defaults to English", () => {
    const i18n = new I18n();
    expect(i18n.locale).toBe("en");
    expect(i18n.messages).toBe(locales.en);
    expect(i18n.t("connectWallet")).toBe("Connect Wallet");
  });

  it("switches locale", () => {
    expect(new I18n("zh-CN").t("connectWallet")).toBe("连接钱包");
  });

  it("keeps the requested locale tag while falling back to English", () => {
    const i18n = new I18n("vi-VN");
    expect(i18n.locale).toBe("vi-VN");
    expect(i18n.t("connectWallet")).toBe("Connect Wallet");
  });

  it("interpolates variables", () => {
    expect(new I18n().t("openingWallet", { name: "JoyID" })).toBe(
      "Opening JoyID...",
    );
  });
});
