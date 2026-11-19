import { describe, expect, it, vi } from "vitest";
import { DEFAULT_TRANSFER, REPOSITORY_EXAMPLES } from "../src/app/examples";
import {
  createSourceDocument,
  sourceOriginLabel,
} from "../src/app/sourceDocument";

const reference = "https://source.test/code";
const remote = { kind: "remote", reference };
const draft = { kind: "draft" };

function fixture(initialLocation = "https://playground.test/") {
  let location = new URL(initialLocation);
  const navigate = (src?: string) => {
    if (src) {
      location.searchParams.set("src", src);
    } else {
      location.searchParams.delete("src");
    }
  };
  const pushHistory = vi.fn((url: URL) => {
    location = url;
  });
  const storage = { getItem: vi.fn(() => "saved draft"), setItem: vi.fn() };
  const readRemote = vi.fn<(ref: string) => Promise<string | undefined>>();
  const confirm = vi.fn(() => true);
  const isExecuting = vi.fn(() => false);
  const onOpened = vi.fn();
  const source = createSourceDocument(
    {
      storage: () => storage,
      location: () => new URL(location),
      pushHistory,
      confirm,
      readRemote,
      isExecuting,
      onOpened,
    },
    vi.fn(),
  );
  const persist = () => {
    const { text, origin } = source.getDocument();
    source.persistDraft(text, origin);
  };
  return {
    source,
    navigate,
    pushHistory,
    storage,
    readRemote,
    confirm,
    isExecuting,
    onOpened,
    persist,
  };
}

function defer<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe("source document", () => {
  it("runs only the source currently committed to the editor", async () => {
    const f = fixture();
    f.source.restoreHistory();
    const visible = f.source.getDocument();
    expect(
      f.source.executionSource(visible.text, visible.loading, undefined),
    ).toBeUndefined();
    expect(
      f.source.executionSource(visible.text, visible.loading, visible.text),
    ).toBe("saved draft");
    const request = defer<string>();
    f.readRemote.mockReturnValue(request.promise);
    f.navigate(reference);
    const loading = f.source.restoreHistory();
    const pending = f.source.getDocument();
    expect(
      f.source.executionSource(visible.text, visible.loading, visible.text),
    ).toBeUndefined();
    request.resolve("\uFEFFimported\r\nsource");
    await loading;
    expect(
      f.source.executionSource(visible.text, visible.loading, visible.text),
    ).toBeUndefined();
    expect(
      f.source.executionSource(pending.text, pending.loading, pending.text),
    ).toBeUndefined();
    const committed = f.source.getDocument();
    expect(
      f.source.executionSource(committed.text, committed.loading, visible.text),
    ).toBeUndefined();
    expect(
      f.source.executionSource(
        committed.text,
        committed.loading,
        "imported\nsource",
      ),
    ).toBe("\uFEFFimported\r\nsource");
  });

  it("starts at the original default and hydrates the saved draft before the direct import settles", async () => {
    const f = fixture();
    expect(f.source.getDocument()).toMatchObject({
      text: DEFAULT_TRANSFER,
      origin: { kind: "unsaved" },
    });
    const request = defer<string>();
    f.readRemote.mockReturnValue(request.promise);
    f.navigate(reference);
    const loading = f.source.restoreHistory();
    expect(f.source.getDocument()).toMatchObject({
      text: "saved draft",
      origin: draft,
      loading: true,
    });
    f.persist();
    request.reject(Error("HTTP 404"));
    await loading;
    expect(f.source.getDocument()).toMatchObject({
      text: "saved draft",
      origin: draft,
      loading: false,
      notice: expect.stringContaining("HTTP 404"),
    });
    expect(f.storage.setItem).toHaveBeenCalledExactlyOnceWith(
      "playgroundSourceCode",
      "saved draft",
    );
    expect(f.pushHistory).not.toHaveBeenCalled();
  });

  it("does not mark the default safe to persist when initial draft hydration fails", async () => {
    const f = fixture();
    f.navigate(reference);
    f.storage.getItem.mockImplementation(() => {
      throw Error("blocked");
    });
    f.readRemote.mockResolvedValue("remote");
    const loading = f.source.restoreHistory();
    expect(f.source.getDocument().origin.kind).toBe("unsaved");
    f.persist();
    await loading;
    f.persist();
    expect(f.storage.setItem).not.toHaveBeenCalled();
  });

  it("commits history once on successful confirmed import and does not persist imported edits", async () => {
    const f = fixture();
    f.source.restoreHistory();
    f.readRemote.mockRejectedValueOnce(Error("HTTP 404"));
    await f.source.importSource(reference, "url");
    expect(f.pushHistory).not.toHaveBeenCalled();
    expect(f.source.getDocument()).toMatchObject({
      origin: draft,
      text: "saved draft",
      loading: false,
    });
    const request = defer<string>();
    f.readRemote.mockReturnValue(request.promise);
    const loading = f.source.importSource(reference, "url");
    expect(f.pushHistory).not.toHaveBeenCalled();
    request.resolve("remote code");
    await loading;
    expect(f.source.getDocument()).toMatchObject({
      origin: remote,
      text: "remote code",
      loading: false,
    });
    expect(sourceOriginLabel(f.source.getDocument().origin)).toBe(reference);
    expect(f.pushHistory).toHaveBeenCalledOnce();
    expect(f.pushHistory.mock.lastCall![0].searchParams.get("src")).toBe(
      reference,
    );
    expect(f.onOpened).toHaveBeenCalledOnce();
    f.source.edit("edited remote code");
    f.persist();
    expect(f.storage.setItem).not.toHaveBeenCalled();
  });

  it("ignores a cancelled response and suppresses errors from superseded requests", async () => {
    const f = fixture();
    f.source.restoreHistory();
    const cancelled = defer<string>();
    f.readRemote.mockReturnValueOnce(cancelled.promise);
    const pending = f.source.importSource(reference, "url");
    f.source.cancelLoad();
    cancelled.resolve("cancelled");
    await pending;
    expect(f.source.getDocument()).toMatchObject({
      origin: draft,
      text: "saved draft",
      loading: false,
    });
    const superseded = defer<string>();
    f.readRemote.mockReturnValueOnce(superseded.promise);
    const pendingAgain = f.source.importSource(reference, "url");
    f.navigate("nostr:nevent-replacement");
    f.readRemote.mockResolvedValue("latest");
    await f.source.restoreHistory();
    superseded.reject(Error("stale"));
    await pendingAgain;
    expect(f.source.getDocument()).toMatchObject({
      origin: { kind: "remote", reference: "nostr:nevent-replacement" },
      text: "latest",
      loading: false,
      notice: "Source loaded. Review the code before running it.",
    });
    expect(f.pushHistory).not.toHaveBeenCalled();
  });

  it("defers history during execution and consults the latest URL after settlement", async () => {
    const f = fixture();
    f.navigate(reference);
    f.readRemote.mockResolvedValue("running source");
    await f.source.restoreHistory();
    f.isExecuting.mockReturnValue(true);
    f.navigate();
    f.source.restoreHistory();
    const latest = "https://source.test/latest";
    f.navigate(latest);
    f.source.restoreHistory();
    expect(f.source.getDocument().text).toBe("running source");
    expect(f.readRemote).toHaveBeenCalledExactlyOnceWith(reference);
    f.isExecuting.mockReturnValue(false);
    f.readRemote.mockResolvedValue("latest source");
    await f.source.flushHistory();
    await f.source.flushHistory();
    expect(f.readRemote.mock.calls).toEqual([[reference], [latest]]);
    expect(f.source.getDocument().text).toBe("latest source");
    expect(f.pushHistory).not.toHaveBeenCalled();
  });

  it("Back restores a local draft and clears the remote error; Forward loads without pushing history", async () => {
    const f = fixture();
    f.navigate(reference);
    f.readRemote.mockRejectedValueOnce(Error("HTTP 404"));
    await f.source.restoreHistory();
    expect(f.source.getDocument().notice).toContain("HTTP 404");
    f.navigate();
    await f.source.restoreHistory();
    expect(f.source.getDocument()).toMatchObject({
      text: "saved draft",
      origin: draft,
      notice: "",
      loading: false,
    });
    f.navigate(reference);
    f.readRemote.mockResolvedValue("remote again");
    await f.source.restoreHistory();
    expect(f.source.getDocument()).toMatchObject({
      text: "remote again",
      origin: remote,
      loading: false,
    });
    expect(f.pushHistory).not.toHaveBeenCalled();
  });

  it("keeps imported ownership when history cannot restore the draft", async () => {
    const f = fixture();
    f.navigate(reference);
    f.readRemote.mockResolvedValue("remote");
    await f.source.restoreHistory();
    f.navigate();
    f.storage.getItem.mockImplementation(() => {
      throw Error("blocked");
    });
    f.source.restoreHistory();
    expect(f.source.getDocument()).toMatchObject({
      text: "remote",
      origin: remote,
      notice: expect.stringContaining("Local storage is unavailable"),
      loading: false,
    });
    f.persist();
    expect(f.storage.setItem).not.toHaveBeenCalled();
  });

  it("restores a draft only after confirmation, clears errors, and strips src from the new history entry", async () => {
    const f = fixture();
    f.navigate(reference);
    f.readRemote.mockResolvedValue("remote");
    await f.source.restoreHistory();
    f.source.setNotice("Could not load source: HTTP 404");
    f.confirm.mockReturnValueOnce(false);
    f.source.restoreDraft();
    expect(f.source.getDocument()).toMatchObject({
      text: "remote",
      origin: remote,
      notice: expect.stringContaining("HTTP 404"),
    });
    expect(f.pushHistory).not.toHaveBeenCalled();
    f.source.restoreDraft();
    expect(f.source.getDocument()).toMatchObject({
      text: "saved draft",
      origin: draft,
      notice: "",
      loading: false,
    });
    expect(f.pushHistory).toHaveBeenCalledOnce();
    expect(f.pushHistory.mock.lastCall![0].searchParams.has("src")).toBe(false);
    expect(f.onOpened).toHaveBeenCalledTimes(2);
  });

  it("keeps local storage retryable after an autosave failure", () => {
    const f = fixture();
    f.source.restoreHistory();
    f.storage.setItem.mockImplementationOnce(() => {
      throw Error("quota");
    });
    f.source.edit("earlier");
    f.persist();
    expect(f.source.getDocument().savedDraft).toBeUndefined();
    f.source.edit("later");
    f.persist();
    expect(f.source.getDocument().savedDraft).toBe("later");
  });

  it("loads repository examples only after confirmation using the ordinary remote import path", async () => {
    const f = fixture();
    const example = REPOSITORY_EXAMPLES[0].sourceUrl;
    f.source.restoreHistory();
    f.confirm.mockReturnValueOnce(false);
    f.source.importSource(example, "example");
    expect(f.readRemote).not.toHaveBeenCalled();
    expect(f.confirm).toHaveBeenCalledExactlyOnceWith(
      "Load this repository example into the editor? Your saved local draft will be kept.",
    );
    const request = defer<string>();
    f.readRemote.mockReturnValue(request.promise);
    const loading = f.source.importSource(example, "example");
    f.source.importSource(example, "example");
    expect(f.confirm).toHaveBeenCalledTimes(2);
    expect(f.readRemote).toHaveBeenCalledExactlyOnceWith(example);
    request.resolve("example code");
    await loading;
    expect(f.source.getDocument()).toMatchObject({
      text: "example code",
      origin: { kind: "remote", reference: example },
    });
    expect(f.pushHistory).toHaveBeenCalledOnce();
  });
});
