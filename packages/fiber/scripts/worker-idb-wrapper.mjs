/**
 * Runs inside the worker thread. Loads fake-indexeddb so indexedDB is available
 * on the worker global, then runs the fiber worker script (passed via workerData).
 * Required because Node worker threads have separate globals from the main thread.
 * Expose WorkerGlobalScope-like APIs (postMessage, onmessage, onerror) so fiber-js works.
 */
import "fake-indexeddb/auto";
import { parentPort, workerData } from "worker_threads";

// Browser WorkerGlobalScope uses `self` as the global; Node worker has no `self`.
globalThis.self = globalThis;

// In browser workers, postMessage() sends to the parent; in Node we use parentPort.postMessage.
globalThis.postMessage = function postMessage(data) {
  parentPort?.postMessage(data);
};

// WorkerGlobalScope has onerror, onmessage; define so fiber-js doesn't hit "onerror is not defined".
if (typeof globalThis.onerror === "undefined") {
  globalThis.onerror = null;
}
if (typeof globalThis.onmessage === "undefined") {
  globalThis.onmessage = null;
}

// Forward messages from parent (main thread) to the script's onmessage.
parentPort?.on("message", (value) => {
  if (typeof globalThis.onmessage === "function") {
    globalThis.onmessage({ data: value });
  }
});

eval(workerData.script);
