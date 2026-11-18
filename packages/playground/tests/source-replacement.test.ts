import { readFileSync } from "node:fs";
import ts from "typescript";
import { describe, expect, it, vi } from "vitest";

const page = readFileSync(
  new URL("../src/app/page.tsx", import.meta.url),
  "utf8",
);
const handler = page.slice(
  page.indexOf("  const replaceSource ="),
  page.indexOf("\n\n  return (\n    <main"),
);

function fixture(confirmed: boolean) {
  const state = {
    source: "old",
    notice: "Could not load source: HTTP 404",
    origin: "remote",
    loading: true,
    dialog: "load",
    pane: "output",
  };
  const loadVersion = { current: 7 };
  const pushState = vi.fn();
  const setters = [
    "source",
    "notice",
    "origin",
    "loading",
    "dialog",
    "pane",
  ].map((key) => (value: unknown) => {
    Object.assign(state, { [key]: value });
  });
  const compiled = ts.transpile(handler + "\nreturn replaceSource;", {
    target: ts.ScriptTarget.ES2022,
  });
  const replace = new Function(
    "source",
    "window",
    "loadVersion",
    "setSource",
    "setNotice",
    "setOrigin",
    "setIsLoading",
    "setDialog",
    "setMobilePane",
    compiled,
  )(
    state.source,
    {
      confirm: () => confirmed,
      location: { href: "https://example.test/?src=bad" },
      history: { pushState },
    },
    loadVersion,
    ...setters,
  );
  return { state, loadVersion, pushState, replace };
}

describe("source replacement notification recovery", () => {
  it("clears stale load errors only after confirmed draft restoration", () => {
    const f = fixture(true);
    f.replace("saved draft", "Local draft");
    expect(f.state).toEqual({
      source: "saved draft",
      notice: "",
      origin: "Local draft",
      loading: false,
      dialog: undefined,
      pane: "code",
    });
    expect(f.loadVersion.current).toBe(8);
    expect(f.pushState.mock.calls[0][2].searchParams.has("src")).toBe(false);
  });
  it("keeps failure and draft unchanged when replacement is cancelled", () => {
    const f = fixture(false);
    f.replace("saved draft", "Local draft");
    expect(f.state.notice).toContain("HTTP 404");
    expect(f.state.source).toBe("old");
    expect(f.loadVersion.current).toBe(7);
    expect(f.pushState).not.toHaveBeenCalled();
  });
});

const historyHandler = page.slice(
  page.indexOf("    const restore = () => {"),
  page.indexOf("\n    restore();"),
);

describe("history source recovery", () => {
  function restore(storageFails = false, search = "") {
    const state = {
      source: "remote",
      notice: "HTTP 404",
      origin: "remote",
      loading: true,
    };
    const version = { current: 1 };
    const loadSource = vi.fn();
    const code = ts.transpile(historyHandler + "\nreturn restore;", {
      target: ts.ScriptTarget.ES2022,
    });
    const fn = new Function(
      "window",
      "loadVersion",
      "loadSource",
      "DEFAULT_TRANSFER",
      "sourceHydrated",
      "running",
      "deferredHistoryRestore",
      "setSource",
      "setNotice",
      "setOrigin",
      "setIsLoading",
      code,
    )(
      {
        location: { search },
        localStorage: {
          getItem: () => {
            if (storageFails) {
              throw Error("unavailable");
            }
            return "saved draft";
          },
        },
      },
      version,
      loadSource,
      "default",
      { current: true },
      { current: false },
      { current: undefined },
      (value: string) => {
        state.source = value;
      },
      (value: string) => {
        state.notice = value;
      },
      (value: string) => {
        state.origin = value;
      },
      (value: boolean) => {
        state.loading = value;
      },
    );
    fn();
    return { state, version, loadSource };
  }
  it("clears a remote failure when Back restores the saved draft", () => {
    expect(restore().state).toEqual({
      source: "saved draft",
      notice: "",
      origin: "Local draft",
      loading: false,
    });
  });
  it("preserves the meaningful storage warning if recovery fails", () => {
    const result = restore(true);
    expect(result.state.notice).toContain("Local storage is unavailable");
    expect(result.state.source).toBe("remote");
    expect(result.state.origin).toBe("remote");
  });
  it("delegates Forward to a remote source without claiming draft recovery", () => {
    const result = restore(false, "?src=https%3A%2F%2Fexample.test%2Fcode.ts");
    expect(result.loadSource).toHaveBeenCalledWith(
      "https://example.test/code.ts",
    );
    expect(result.state.notice).toBe("HTTP 404");
    expect(result.version.current).toBe(2);
  });
});
