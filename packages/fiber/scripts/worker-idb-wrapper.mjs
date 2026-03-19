/**
 * Runs inside each Node.js worker thread spawned by the FiberRuntime polyfill.
 * Sets up IndexedDB (memory or persistent) and exposes WorkerGlobalScope-like
 * globals, then evals the fiber-js inline worker IIFE (passed via workerData).
 *
 * workerData shape:
 *   script: string          — the fiber-js IIFE to eval
 *   storageType: "memory" | "persistent"   (default: "memory")
 *   storageDir?: string     — required when storageType === "persistent"
 */
import { parentPort, workerData } from "worker_threads";

// ── WorkerGlobalScope compatibility ──────────────────────────────────────────
globalThis.self = globalThis;

// In browser workers, postMessage() sends to the parent;
// in Node worker_threads we use parentPort.
globalThis.postMessage = function postMessage(data) {
  parentPort?.postMessage(data);
};

if (typeof globalThis.onerror === "undefined") globalThis.onerror = null;
if (typeof globalThis.onmessage === "undefined") globalThis.onmessage = null;

// Forward messages from the main thread to the script's onmessage handler
parentPort?.on("message", (value) => {
  if (typeof globalThis.onmessage === "function") {
    globalThis.onmessage({ data: value });
  }
});

// ── IndexedDB backend ─────────────────────────────────────────────────────────
const storageType = workerData?.storageType ?? "memory";

if (storageType === "persistent") {
  const storageDir = workerData?.storageDir;
  if (!storageDir) {
    throw new Error(
      "worker-idb-wrapper: storageDir is required for persistent storage mode",
    );
  }
  // indexeddbshim provides a spec-compliant IndexedDB backed by SQLite.
  // Install it: pnpm add indexeddbshim  (or npm install indexeddbshim)
  let setGlobalVars;
  try {
    ({ default: setGlobalVars } = await import("indexeddbshim"));
  } catch {
    throw new Error(
      "worker-idb-wrapper: persistent storage requires the 'indexeddbshim' package.\n" +
        "Install it with: pnpm add indexeddbshim",
    );
  }
  setGlobalVars(globalThis, {
    checkOrigin: false,
    databaseBasePath: storageDir,
  });
} else {
  // Default: in-memory IndexedDB (fake-indexeddb)
  await import("fake-indexeddb/auto");
}

// ── Run the fiber-js worker IIFE ──────────────────────────────────────────────
eval(workerData.script);
