import { describe, expect, it } from "vitest";
import {
  I18n,
  interpolate,
  locales,
  matchLocale,
  resolveConnectorLocale,
  type LocaleCandidate,
} from "./index.js";
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
  it("matches exact and case-insensitive tags", () => {
    expect(resolveConnectorLocale("en")).toBe("en");
    expect(resolveConnectorLocale("zh-Hans")).toBe("zh-Hans");
    expect(resolveConnectorLocale("zh-hans")).toBe("zh-Hans");
  });

  it("maps region tags to the locale of the same language and script", () => {
    expect(resolveConnectorLocale("zh-CN")).toBe("zh-Hans");
    expect(resolveConnectorLocale("zh-cn")).toBe("zh-Hans");
    expect(resolveConnectorLocale("zh_cn")).toBe("zh-Hans");
    expect(resolveConnectorLocale("zh-SG")).toBe("zh-Hans");
    expect(resolveConnectorLocale("zh")).toBe("zh-Hans");
    expect(resolveConnectorLocale("en-US")).toBe("en");
    expect(resolveConnectorLocale("en-GB")).toBe("en");
  });

  it("falls back to a registered locale of the same language", () => {
    // No zh-Hant yet: Traditional Chinese readers get Simplified, not English.
    expect(resolveConnectorLocale("zh-HK")).toBe("zh-Hans");
    expect(resolveConnectorLocale("zh_TW")).toBe("zh-Hans");
    expect(resolveConnectorLocale("zh-Hant")).toBe("zh-Hans");
    // zh-Latn is not a real script for Chinese: the first registered zh
    // locale (zh-Hans) wins over English.
    expect(resolveConnectorLocale("zh-Latn")).toBe("zh-Hans");
  });

  it("falls back to English for unknown languages and invalid input", () => {
    expect(resolveConnectorLocale("vi-VN")).toBe("en");
    expect(resolveConnectorLocale("ja")).toBe("en");
    expect(resolveConnectorLocale("")).toBe("en");
    expect(resolveConnectorLocale("???")).toBe("en");
    expect(resolveConnectorLocale(null)).toBe("en");
    expect(resolveConnectorLocale(undefined)).toBe("en");
  });
});

describe("matchLocale", () => {
  const hans: LocaleCandidate = {
    key: "zh-Hans",
    language: "zh",
    script: "Hans",
  };
  const hant: LocaleCandidate = {
    key: "zh-Hant",
    language: "zh",
    script: "Hant",
  };
  const en: LocaleCandidate = { key: "en", language: "en", script: "Latn" };

  // Registration order must not change which variant a tag resolves to.
  describe.each([
    ["hans first", [hans, hant, en]],
    ["hant first", [hant, hans, en]],
  ] as const)("with %s", (_label, candidates) => {
    it.each([
      ["zh-CN", "zh-Hans"],
      ["zh-SG", "zh-Hans"],
      ["zh-HK", "zh-Hant"],
      ["zh-TW", "zh-Hant"],
      ["en-GB", "en"],
    ] as const)("%s → %s", (input, expected) => {
      expect(matchLocale(input, candidates)).toBe(expected);
    });
  });

  it("prefers the first registered locale when only the language matches", () => {
    expect(matchLocale("zh-Latn", [hans, hant])).toBe("zh-Hans");
    expect(matchLocale("zh-Latn", [hant, hans])).toBe("zh-Hant");
  });

  it("returns undefined when nothing matches", () => {
    expect(matchLocale("ja", [hans, hant, en])).toBeUndefined();
    expect(matchLocale("???", [hans, hant, en])).toBeUndefined();
    expect(matchLocale(null, [hans, hant, en])).toBeUndefined();
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
    expect(new I18n("zh-CN").t("connectWallet")).toBe("连接钱包");
  });

  it("exposes the resolved locale, not the requested tag", () => {
    expect(new I18n("zh-CN").locale).toBe("zh-Hans");
    expect(new I18n("zh-HK").locale).toBe("zh-Hans");
    expect(new I18n("vi-VN").locale).toBe("en");
    expect(new I18n("vi-VN").t("connectWallet")).toBe("Connect Wallet");
  });

  it("interpolates variables", () => {
    expect(new I18n().t("openingWallet", { name: "JoyID" })).toBe(
      "Opening JoyID...",
    );
  });
});
