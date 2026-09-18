import { afterEach, describe, expect, it, vi } from "vitest";
import { waitForAvailability } from "./index.js";

function createBrowser(
  visibilityState: DocumentVisibilityState,
  onLine: boolean,
) {
  const document = Object.assign(new EventTarget(), { visibilityState });
  const navigator = { onLine };
  const window = new EventTarget();
  vi.stubGlobal("document", document);
  vi.stubGlobal("navigator", navigator);
  vi.stubGlobal("window", window);
  return { document, navigator, window };
}

describe("waitForAvailability", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("resolves when the visible page comes online", async () => {
    const { navigator, window } = createBrowser("visible", false);
    const waiting = waitForAvailability();

    navigator.onLine = true;
    window.dispatchEvent(new Event("online"));

    await expect(waiting).resolves.toBeUndefined();
  });

  it("waits until the online page becomes visible", async () => {
    const { document, navigator, window } = createBrowser("hidden", false);
    let resolved = false;
    const waiting = waitForAvailability().then(() => {
      resolved = true;
    });

    navigator.onLine = true;
    window.dispatchEvent(new Event("online"));
    await Promise.resolve();
    expect(resolved).toBe(false);

    document.visibilityState = "visible";
    document.dispatchEvent(new Event("visibilitychange"));

    await expect(waiting).resolves.toBeUndefined();
  });

  it("rejects immediately when already aborted", async () => {
    const reason = new Error("Cancelled");

    await expect(waitForAvailability(AbortSignal.abort(reason))).rejects.toBe(
      reason,
    );
  });

  it("rejects and removes its listeners when aborted", async () => {
    const { document, window } = createBrowser("hidden", false);
    const removeDocumentListener = vi.spyOn(document, "removeEventListener");
    const removeWindowListener = vi.spyOn(window, "removeEventListener");
    const controller = new AbortController();
    const reason = new Error("Cancelled");
    const waiting = waitForAvailability(controller.signal);
    const rejected = expect(waiting).rejects.toBe(reason);

    controller.abort(reason);

    await rejected;
    expect(removeDocumentListener).toHaveBeenCalledWith(
      "visibilitychange",
      expect.any(Function),
    );
    expect(removeWindowListener).toHaveBeenCalledWith(
      "online",
      expect.any(Function),
    );
  });
});
