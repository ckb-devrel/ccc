import { readFileSync } from "node:fs";
import ts from "typescript";
import { describe, expect, it, vi } from "vitest";
const page = readFileSync(
  new URL("../src/app/page.tsx", import.meta.url),
  "utf8",
);
const loadHandler = page
  .slice(
    page.indexOf("    async (src: string"),
    page.indexOf("    [setMobilePane],"),
  )
  .trim()
  .replace(/,$/, "");
const restoreHandler = page.slice(
  page.indexOf("    const restore = () => {"),
  page.indexOf("\n    restore();"),
);
function compile(code: string, env: Record<string, unknown>) {
  return new Function(
    ...Object.keys(env),
    ts.transpile(code, { target: ts.ScriptTarget.ES2022 }),
  )(...Object.values(env));
}
function fixture() {
  const state = {
    source: "saved draft",
    origin: "Local draft",
    notice: "",
    loading: false,
  };
  const storage = { getItem: vi.fn(() => "saved draft"), setItem: vi.fn() };
  const location = { href: "https://playground.test/", search: "" };
  const pushState = vi.fn((_: unknown, __: unknown, url: URL) => {
    location.href = url.href;
    location.search = url.search;
  });
  const env = {
    sourceHydrated: { current: true },
    loadVersion: { current: 0 },
    running: { current: false },
    deferredHistoryRestore: { current: undefined as undefined | (() => void) },
    window: { location, history: { pushState }, localStorage: storage },
    DEFAULT_TRANSFER: "default",
    DEFAULT_NOSTR_RELAYS: [],
    getFromNEvent: vi.fn(),
    fetch: vi.fn(),
    setMobilePane: vi.fn(),
    setDialog: vi.fn(),
    setSource: (v: string) => {
      state.source = v;
    },
    setOrigin: (v: string) => {
      state.origin = v;
    },
    setNotice: (v: string) => {
      state.notice = v;
    },
    setIsLoading: (v: boolean) => {
      state.loading = v;
    },
  };
  const load = compile("return " + loadHandler, env) as (
    s: string,
    commit?: boolean,
  ) => Promise<void>;
  const restore = compile(restoreHandler + ";return restore;", {
    ...env,
    loadSource: load,
  }) as () => void;
  return { state, env, load, restore, storage, pushState };
}
describe("source import and history ownership", () => {
  it("initial URL loading hydrates the saved draft before enabling persistence", async () => {
    const f = fixture();
    f.state.source = "default transfer";
    f.env.sourceHydrated.current = false;
    f.env.window.location.search = "?src=https%3A%2F%2Fsource.test%2Fbad";
    f.env.fetch.mockResolvedValue({ ok: false, status: 404 });
    f.restore();
    await Promise.resolve();
    await Promise.resolve();
    expect(f.state.source).toBe("saved draft");
    expect(f.state.origin).toBe("Local draft");
  });
  it("initial storage failure cannot mark default/imported text safe to autosave", () => {
    const f = fixture();
    f.env.sourceHydrated.current = false;
    f.env.window.location.search = "?src=https%3A%2F%2Fsource.test%2Fbad";
    f.storage.getItem.mockImplementation(() => {
      throw Error("blocked");
    });
    f.env.fetch.mockImplementation(() => new Promise(() => {}));
    f.restore();
    expect(f.state.origin).toBe("Unsaved source");
  });
  it("keeps draft origin and autosave eligibility after failed import", async () => {
    const f = fixture();
    f.env.fetch.mockResolvedValue({ ok: false, status: 404 });
    await f.load("https://source.test/bad", true);
    expect(f.state.origin).toBe("Local draft");
    expect(f.state.source).toBe("saved draft");
    expect(f.pushState).not.toHaveBeenCalled();
  });
  it("commits history only after accepted success", async () => {
    const f = fixture();
    let release!: (x: unknown) => void;
    f.env.fetch.mockImplementation(
      () =>
        new Promise((r) => {
          release = r;
        }),
    );
    const p = f.load("https://source.test/code", true);
    expect(f.pushState).not.toHaveBeenCalled();
    expect(f.state.origin).toBe("Local draft");
    release({ ok: true, text: async () => "remote code" });
    await p;
    expect(f.state.source).toBe("remote code");
    expect(f.pushState).toHaveBeenCalledTimes(1);
    expect(f.env.window.location.search).toContain("src=");
  });
  it("cancelled and stale responses never commit source or history", async () => {
    const f = fixture();
    let release!: (x: unknown) => void;
    f.env.fetch.mockImplementation(
      () =>
        new Promise((r) => {
          release = r;
        }),
    );
    const p = f.load("https://source.test/code", true);
    ++f.env.loadVersion.current;
    release({ ok: true, text: async () => "obsolete" });
    await p;
    expect(f.state.source).toBe("saved draft");
    expect(f.state.origin).toBe("Local draft");
    expect(f.pushState).not.toHaveBeenCalled();
  });
  it("direct URL and popstate loads do not add history entries", async () => {
    const f = fixture();
    f.env.fetch.mockResolvedValue({ ok: true, text: async () => "remote" });
    await f.load("https://source.test/code");
    expect(f.state.source).toBe("remote");
    expect(f.pushState).not.toHaveBeenCalled();
  });
  it("deferred history uses the latest URL only after the run settles", async () => {
    const f = fixture();
    f.state.source = "running source";
    f.state.origin = "remote";
    f.env.running.current = true;
    f.restore();
    expect(f.state.source).toBe("running source");
    f.env.window.location.search = "?src=https%3A%2F%2Fsource.test%2Fnew";
    f.restore();
    f.env.fetch.mockResolvedValue({ ok: true, text: async () => "latest" });
    f.env.running.current = false;
    f.env.deferredHistoryRestore.current!();
    await Promise.resolve();
    await Promise.resolve();
    expect(f.state.source).toBe("latest");
    expect(f.env.deferredHistoryRestore.current).toBeUndefined();
    expect(f.pushState).not.toHaveBeenCalled();
  });
  it("failed draft read retains imported ownership and warning", () => {
    const f = fixture();
    f.state.source = "remote code";
    f.state.origin = "remote";
    f.storage.getItem.mockImplementation(() => {
      throw Error("blocked");
    });
    f.restore();
    expect(f.state.origin).toBe("remote");
    expect(f.state.source).toBe("remote code");
    expect(f.state.notice).toContain("unavailable");
  });
});
