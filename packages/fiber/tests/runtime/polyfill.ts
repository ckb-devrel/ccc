/**
 * Node.js polyfills for @nervosnetwork/fiber-js.
 *
 * fiber-js is browser-only: it uses Blob, URL.createObjectURL, and Worker to
 * spin up inline Web Workers (the fiber WASM and its DB worker are bundled as
 * IIFE strings). This module patches those three globals on globalThis so that
 * fiber-js can start inside a Node.js process.
 *
 * Call installNodePolyfills() BEFORE constructing a Fiber instance.
 * Safe to call multiple times — installs only on the first call.
 */
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Worker as NodeWorker } from "node:worker_threads";
import type { StorageMode } from "./config.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Works from both tests/runtime/ (vitest) and any compiled path:
// join(__dirname, "..", "..", "scripts") → packages/fiber/scripts/
const SCRIPTS_DIR = join(__dirname, "..", "..", "scripts");
const WORKER_IDB_WRAPPER_PATH = join(SCRIPTS_DIR, "worker-idb-wrapper.mjs");

function checkWrapperExists(): void {
  if (!existsSync(WORKER_IDB_WRAPPER_PATH)) {
    throw new Error(
      `FiberRuntime: worker wrapper not found at ${WORKER_IDB_WRAPPER_PATH}.\n` +
        `Ensure packages/fiber/scripts/worker-idb-wrapper.mjs exists.`,
    );
  }
}

/** Adapt a Node.js worker_threads.Worker to the browser Worker interface. */
function adaptNodeWorker(nodeWorker: NodeWorker): Worker {
  type MsgListener = (ev: MessageEvent) => void;
  type ErrListener = (ev: ErrorEvent) => void;

  const listeners: { message: MsgListener[]; error: ErrListener[] } = {
    message: [],
    error: [],
  };
  let onmessageFn: MsgListener | null = null;
  let onerrorFn: ErrListener | null = null;

  nodeWorker.on("message", (data: unknown) => {
    const ev = { data, type: "message" } as MessageEvent;
    onmessageFn?.(ev);
    listeners.message.forEach((fn) => fn(ev));
  });
  nodeWorker.on("error", (err: Error) => {
    const ev = {
      message: err.message,
      filename: err.stack,
      type: "error",
    } as ErrorEvent;
    onerrorFn?.(ev);
    listeners.error.forEach((fn) => fn(ev));
  });

  return {
    postMessage: (data: unknown) => nodeWorker.postMessage(data),
    terminate: () => void nodeWorker.terminate(),
    get onmessage() {
      return onmessageFn;
    },
    set onmessage(fn: MsgListener | null) {
      onmessageFn = fn;
    },
    get onerror() {
      return onerrorFn;
    },
    set onerror(fn: ErrListener | null) {
      onerrorFn = fn;
    },
    addEventListener(
      type: "message" | "error",
      listener: MsgListener | ErrListener,
    ) {
      (listeners[type] as (MsgListener | ErrListener)[]).push(listener);
    },
    removeEventListener(
      type: "message" | "error",
      listener: MsgListener | ErrListener,
    ) {
      const list = listeners[type] as (MsgListener | ErrListener)[];
      const i = list.indexOf(listener);
      if (i !== -1) list.splice(i, 1);
    },
    dispatchEvent: () => true,
  } as unknown as Worker;
}

let installed = false;

/**
 * Install Node.js polyfills for Blob, URL.createObjectURL/revokeObjectURL,
 * and Worker so that @nervosnetwork/fiber-js can run in Node.js.
 *
 * The storage mode is captured at install time and passed to every Worker
 * spawned by fiber-js via workerData. Calling this function a second time
 * is a no-op — the first call's storage mode wins for the lifetime of the
 * process.
 */
export function installNodePolyfills(
  storage: StorageMode = { type: "memory" },
): void {
  if (installed) return;
  installed = true;

  checkWrapperExists();

  const OriginalBlob = globalThis.Blob;
  const OriginalCreateObjectURL = URL.createObjectURL.bind(URL);
  const OriginalRevokeObjectURL = URL.revokeObjectURL?.bind(URL);

  // Map blob objects → their inline JS script text (set during createObjectURL intercept)
  const blobToScript = new WeakMap<Blob, string>();
  // Map fake blob: URL ids → their script text (looked up when Worker is constructed)
  const scriptStore = new Map<string, string>();
  let blobIdCounter = 0;

  // Intercept Blob construction: capture the inline IIFE script text
  function PatchedBlob(
    this: Blob,
    parts?: BlobPart[],
    options?: BlobPropertyBag,
  ): Blob {
    const blob = new OriginalBlob(parts, options);
    if (
      parts?.length === 1 &&
      typeof parts[0] === "string" &&
      options?.type === "text/javascript"
    ) {
      blobToScript.set(blob, parts[0]);
    }
    return blob;
  }
  (globalThis as unknown as { Blob: typeof Blob }).Blob =
    PatchedBlob as unknown as typeof Blob;

  // Intercept createObjectURL: return a fake blob: id instead of a real URL
  URL.createObjectURL = (obj: Blob | MediaSource): string => {
    const script = blobToScript.get(obj as Blob);
    if (script !== undefined) {
      const id = `nodejs-inline-${++blobIdCounter}`;
      scriptStore.set(id, script);
      return `blob:${id}`;
    }
    return OriginalCreateObjectURL(obj);
  };

  if (OriginalRevokeObjectURL) {
    URL.revokeObjectURL = (url: string): void => {
      if (url.startsWith("blob:nodejs-inline-")) {
        scriptStore.delete(url.replace("blob:", ""));
        return;
      }
      OriginalRevokeObjectURL(url);
    };
  }

  // Worker extra data to pass to the wrapper (storage config)
  const workerExtraData: Record<string, unknown> =
    storage.type === "persistent"
      ? { storageType: "persistent", storageDir: storage.dir }
      : { storageType: "memory" };

  // Replace globalThis.Worker: intercept blob: URLs created above and spawn
  // real Node.js worker threads running the IDB wrapper + the fiber IIFE
  (globalThis as unknown as { Worker: typeof Worker }).Worker = function (
    url: string | URL,
  ): Worker {
    const urlStr = typeof url === "string" ? url : url.toString();
    if (urlStr.startsWith("blob:nodejs-inline-")) {
      const id = urlStr.replace("blob:", "");
      const script = scriptStore.get(id);
      scriptStore.delete(id);
      if (script) {
        const nodeWorker = new NodeWorker(WORKER_IDB_WRAPPER_PATH, {
          workerData: { script, ...workerExtraData },
          eval: false,
        });
        return adaptNodeWorker(nodeWorker);
      }
    }
    throw new Error(
      `FiberRuntime polyfill: only blob:nodejs-inline-* Workers are supported. Got: ${urlStr}`,
    );
  } as unknown as typeof Worker;
}
