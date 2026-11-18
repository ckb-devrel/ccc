import { ccc } from "@ckb-ccc/ccc";
import { bech32 } from "bech32";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getFromNEvent, shareToNostr } from "../src/app/nostr";

const state = vi.hoisted(() => ({
  sockets: [] as Array<{ url: string; closed: boolean }>,
  fail: false,
  prefix: [] as unknown[][],
  event: {} as Record<string, unknown>,
  terminal: false,
  silent: false,
}));
vi.mock("isomorphic-ws", () => ({
  default: class {
    CLOSED = 3;
    CLOSING = 2;
    readyState = 1;
    closed = false;
    onopen: (() => void) | null = null;
    onclose: (() => void) | null = null;
    onerror: (() => void) | null = null;
    onmessage: ((event: { data: string }) => void) | null = null;
    listeners: Array<() => void> = [];
    constructor(public url: string) {
      state.sockets.push(this);
      queueMicrotask(() => this.onopen?.());
    }
    addEventListener(_event: string, fn: () => void) {
      this.listeners.push(fn);
    }
    removeEventListener(_event: string, fn: () => void) {
      this.listeners = this.listeners.filter((entry) => entry !== fn);
    }
    close() {
      this.closed = true;
      this.readyState = 3;
      this.listeners.forEach((fn) => fn());
      this.onclose?.();
    }
    send(raw: string) {
      const request = JSON.parse(raw);
      for (const frame of state.prefix) {
        queueMicrotask(() => this.onmessage?.({ data: JSON.stringify(frame) }));
      }
      if (state.silent) {
        return;
      }
      if (request[0] === "EVENT") {
        queueMicrotask(() =>
          this.onmessage?.({
            data: JSON.stringify(["OK", request[1].id, !state.fail]),
          }),
        );
        return;
      }
      queueMicrotask(() =>
        this.onmessage?.({
          data: JSON.stringify(
            state.fail ? ["EOSE", "1"] : ["EVENT", "1", state.event],
          ),
        }),
      );
      if (state.terminal) {
        queueMicrotask(() =>
          this.onmessage?.({ data: JSON.stringify(["EOSE", "1"]) }),
        );
      }
    }
  },
}));
let requestedId: string;
const reference = () => {
  const relay = new TextEncoder().encode("wss://hint.example");
  return bech32.encode(
    "nevent",
    bech32.toWords(
      new Uint8Array([
        0,
        32,
        ...ccc.bytesFrom(requestedId),
        1,
        relay.length,
        ...relay,
      ]),
    ),
    65536,
  );
};
describe("Nostr source loading", () => {
  beforeEach(async () => {
    vi.stubGlobal("window", globalThis);
    state.sockets = [];
    state.fail = false;
    state.prefix = [];
    state.terminal = false;
    state.silent = false;
    state.event = await new ccc.SignerNostrPrivateKey(
      {} as ccc.Client,
      "0x" + "01".repeat(32),
    ).signNostrEvent({
      kind: 1050,
      created_at: 1,
      tags: [],
      content: "console.log('imported')",
    });
    requestedId = state.event.id as string;
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });
  it("uses both default relays and embedded relay hints, then closes sockets", async () => {
    await expect(
      getFromNEvent(["wss://default.example"], reference()),
    ).resolves.toBe("console.log('imported')");
    expect(state.sockets.map((s) => s.url)).toEqual([
      "wss://default.example",
      "wss://hint.example",
    ]);
    expect(state.sockets.every((s) => s.closed)).toBe(true);
  });
  it("rejects missing events and still closes every socket", async () => {
    state.fail = true;
    await expect(getFromNEvent([], reference())).rejects.toThrow();
    expect(state.sockets.every((s) => s.closed)).toBe(true);
  });
  it("ignores notices and unrelated subscriptions before valid events", async () => {
    state.prefix = [
      ["NOTICE", "welcome"],
      ["EOSE", "other"],
      ["CLOSED", "other", "bye"],
      ["EVENT", "other", state.event],
    ];
    await expect(getFromNEvent([], reference())).resolves.toBe(
      "console.log('imported')",
    );
  });
  it.each([
    "missing fields",
    "wrong id",
    "tampered content",
    "invalid signature",
    "wrong kind",
  ])("rejects %s", async (mode) => {
    if (mode === "missing fields") {
      state.event = { content: "replacement" };
    }
    if (mode === "wrong id") {
      state.event.id = "02".repeat(32);
    }
    if (mode === "tampered content") {
      state.event.content = "replacement";
    }
    if (mode === "invalid signature") {
      state.event.sig = "00".repeat(64);
    }
    if (mode === "wrong kind") {
      state.event = await new ccc.SignerNostrPrivateKey(
        {} as ccc.Client,
        "0x" + "01".repeat(32),
      ).signNostrEvent({
        kind: 1,
        created_at: 1,
        tags: [],
        content: "wrong kind",
      });
      requestedId = state.event.id as string;
    }
    state.terminal = true;
    await expect(getFromNEvent([], reference())).rejects.toThrow();
    expect(state.sockets.every((s) => s.closed)).toBe(true);
  });
  it("ignores an invalid event before a valid one", async () => {
    state.prefix = [["EVENT", "1", { ...state.event, content: "tampered" }]];
    await expect(getFromNEvent([], reference())).resolves.toBe(
      "console.log('imported')",
    );
  });
  it("handles matching CLOSED as terminal", async () => {
    state.prefix = [["CLOSED", "1", "blocked"]];
    await expect(getFromNEvent([], reference())).rejects.toThrow();
  });
  it("times out NOTICE-only relay responses", async () => {
    vi.useFakeTimers();
    state.silent = true;
    state.prefix = [["NOTICE", "waiting"]];
    const result = expect(getFromNEvent([], reference())).rejects.toThrow();
    await vi.advanceTimersByTimeAsync(11000);
    await result;
    expect(state.sockets.every((s) => s.closed)).toBe(true);
  });
  it("rejects invalid references before opening any sockets", async () => {
    await expect(getFromNEvent([], "not-a-nevent")).rejects.toThrow();
    expect(state.sockets).toHaveLength(0);
  });
});

describe("Nostr source publication", () => {
  beforeEach(async () => {
    vi.stubGlobal("window", globalThis);
    state.sockets = [];
    state.fail = false;
    state.prefix = [];
    state.terminal = false;
    state.silent = false;
    state.event = await new ccc.SignerNostrPrivateKey(
      {} as ccc.Client,
      "0x" + "01".repeat(32),
    ).signNostrEvent({
      kind: 1050,
      created_at: 1,
      tags: [],
      content: "console.log('imported')",
    });
    requestedId = state.event.id as string;
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });
  it("returns a nevent with acknowledged relay hints and closes sockets", async () => {
    const owner = ccc.ClientPublicTestnet.open();
    try {
      const result = await shareToNostr(
        owner.value,
        ["wss://publish.example"],
        "console.log('test')",
      );
      expect(bech32.decode(result, 65536).prefix).toBe("nevent");
      expect(state.sockets.every((s) => s.closed)).toBe(true);
    } finally {
      await owner.dispose();
    }
  });
  it("ignores NOTICE and unrelated OK before acceptance", async () => {
    state.prefix = [
      ["NOTICE", "welcome"],
      ["OK", "02".repeat(32), false],
    ];
    const result = await shareToNostr(
      {} as ccc.Client,
      ["wss://publish.example"],
      "test",
    );
    expect(bech32.decode(result, 65536).prefix).toBe("nevent");
  });
  it("times out publication without matching acknowledgment", async () => {
    vi.useFakeTimers();
    state.silent = true;
    state.prefix = [["NOTICE", "waiting"]];
    const result = expect(
      shareToNostr({} as ccc.Client, ["wss://publish.example"], "test"),
    ).rejects.toThrow("Failed to send event");
    await vi.advanceTimersByTimeAsync(6000);
    await result;
    expect(state.sockets.every((s) => s.closed)).toBe(true);
  });
  it("reports rejection rather than returning an unusable share link", async () => {
    state.fail = true;
    const owner = ccc.ClientPublicTestnet.open();
    try {
      await expect(
        shareToNostr(owner.value, ["wss://publish.example"], "test"),
      ).rejects.toThrow("Failed to send event");
    } finally {
      await owner.dispose();
    }
    expect(state.sockets.every((s) => s.closed)).toBe(true);
  });
});
