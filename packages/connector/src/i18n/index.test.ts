import { describe, expect, it } from "vitest";
import {
  connectorLocales,
  I18n,
  interpolate,
  locales,
  resolveConnectorLocale,
} from "./index.js";
import type { MessageKey } from "./types.js";

const messageKeys = Object.keys(locales.en) as MessageKey[];

describe("locales", () => {
  it("connectorLocales lists every built-in locale in registration order", () => {
    expect(connectorLocales).toEqual(Object.keys(locales));
    expect(Object.isFrozen(connectorLocales)).toBe(true);
  });

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

  it("every locale has exactly one {link} in khieHelp", () => {
    for (const [name, messages] of Object.entries(locales)) {
      expect(messages.khieHelp.split("{link}").length, name).toBe(2);
    }
  });

  it("every registry key is a canonical BCP 47 tag", () => {
    for (const key of Object.keys(locales)) {
      expect(Intl.getCanonicalLocales(key)[0], key).toBe(key);
    }
  });

  it("includes English, the final fallback", () => {
    expect(Object.keys(locales)).toContain("en");
  });
});

describe("resolveConnectorLocale", () => {
  it("returns every built-in tag as is", () => {
    for (const locale of connectorLocales) {
      expect(resolveConnectorLocale(locale)).toBe(locale);
    }
  });

  it("falls back to English for anything that is not an exact built-in tag", () => {
    expect(resolveConnectorLocale("zh-hans")).toBe("en");
    expect(resolveConnectorLocale("zh-CN")).toBe("en");
    expect(resolveConnectorLocale("zh")).toBe("en");
    expect(resolveConnectorLocale("en-US")).toBe("en");
    expect(resolveConnectorLocale("")).toBe("en");
    expect(resolveConnectorLocale(null)).toBe("en");
    expect(resolveConnectorLocale(undefined)).toBe("en");
  });
});

describe("interpolate", () => {
  it("replaces known placeholders and keeps unknown ones", () => {
    expect(interpolate("Opening {name}... {other}", { name: "JoyID" })).toBe(
      "Opening JoyID... {other}",
    );
    expect(interpolate("{n} items", { n: 3 })).toBe("3 items");
  });

  it("ignores inherited properties such as {toString}", () => {
    expect(interpolate("{toString}", {})).toBe("{toString}");
  });
});

describe("I18n", () => {
  it("defaults to English", () => {
    const i18n = new I18n();
    expect(i18n.locale).toBe("en");
    expect(i18n.messages).toBe(locales.en);
    expect(i18n.t("connectWallet")).toBe("Connect Wallet");
  });

  it("treats null like no locale", () => {
    expect(new I18n(null).locale).toBe("en");
  });

  it("switches locale", () => {
    expect(new I18n("zh-Hans").t("connectWallet")).toBe("连接钱包");
  });

  it("uses English for unknown tags", () => {
    expect(new I18n("zh-CN").locale).toBe("en");
    expect(new I18n("zh-CN").t("connectWallet")).toBe("Connect Wallet");
  });

  it("interpolates variables", () => {
    expect(new I18n().t("openingWallet", { name: "JoyID" })).toBe(
      "Opening JoyID...",
    );
  });
});
