/**
 * Runs inside each Node.js worker thread spawned by the FiberRuntime polyfill.
 * Sets up IndexedDB (memory or persistent) and exposes WorkerGlobalScope-like
 * globals, then loads the fiber-js inline worker IIFE via a temp file + import()
 * (fiber-js only ships this code as a string; Node has no blob: Worker without
 * executing that string somehow — this avoids eval() while keeping the same runtime).
 *
 * workerData shape:
 *   script: string          — the fiber-js IIFE source to write and import
 *   storageType: "memory" | "persistent"   (default: "memory")
 *   storageDir?: string     — required when storageType === "persistent"
 */
import { randomUUID } from "node:crypto";
import { unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
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

// ── Run the fiber-js worker IIFE (string → temp .mjs → dynamic import) ───────
const script = workerData?.script;
if (typeof script !== "string") {
  throw new Error("worker-idb-wrapper: workerData.script must be a string");
}
const tmpPath = join(tmpdir(), `ccc-fiber-inline-worker-${randomUUID()}.mjs`);
writeFileSync(tmpPath, script, "utf8");
try {
  await import(pathToFileURL(tmpPath).href);
} finally {
  try {
    unlinkSync(tmpPath);
  } catch {
    // ignore (e.g. concurrent unlink or platform quirks)
  }
}
