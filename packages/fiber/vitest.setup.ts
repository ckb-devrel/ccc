/**
 * Polyfill Worker, Blob/createObjectURL, and IndexedDB so @nervosnetwork/fiber-js can start in Node.
 * - IndexedDB: fiber-wasm runs inside Workers; each worker has its own global, so we run
 *   fake-indexeddb inside the worker via a wrapper script (worker-idb-wrapper.mjs).
 * - Worker + blob URLs: fiber-js uses Blob -> createObjectURL -> new Worker(blobUrl);
 *   we create a Node worker that runs the wrapper (which loads IndexedDB then evals the script).
 */
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Worker as NodeWorker } from "node:worker_threads";

const __dirname = dirname(fileURLToPath(import.meta.url));
const WORKER_IDB_WRAPPER_PATH = join(
  __dirname,
  "scripts",
  "worker-idb-wrapper.mjs",
);
if (!existsSync(WORKER_IDB_WRAPPER_PATH)) {
  throw new Error(
    `Vitest setup: worker wrapper not found at ${WORKER_IDB_WRAPPER_PATH}. Ensure packages/fiber/scripts/worker-idb-wrapper.mjs exists.`,
  );
}

const OriginalBlob = globalThis.Blob;
const OriginalCreateObjectURL = URL.createObjectURL.bind(URL);
const OriginalRevokeObjectURL = URL.revokeObjectURL?.bind(URL);

const blobToScript = new WeakMap<Blob, string>();
const scriptStore = new Map<string, string>();
let blobIdCounter = 0;

function PatchedBlob(
  this: Blob,
  parts?: BlobPart[],
  options?: BlobPropertyBag,
): Blob {
  const blob = new OriginalBlob(parts, options);
  if (
    parts &&
    parts.length === 1 &&
    typeof parts[0] === "string" &&
    options?.type === "text/javascript"
  ) {
    blobToScript.set(blob, parts[0]);
  }
  return blob;
}
(globalThis as unknown as { Blob: typeof Blob }).Blob =
  PatchedBlob as unknown as typeof Blob;

URL.createObjectURL = function (obj: Blob | MediaSource): string {
  const script = blobToScript.get(obj as Blob);
  if (script !== undefined) {
    const id = `nodejs-inline-${++blobIdCounter}`;
    scriptStore.set(id, script);
    return `blob:${id}`;
  }
  return OriginalCreateObjectURL(obj);
};

if (OriginalRevokeObjectURL) {
  URL.revokeObjectURL = function (url: string): void {
    if (url.startsWith("blob:nodejs-inline-")) {
      scriptStore.delete(url.replace("blob:", ""));
      return;
    }
    OriginalRevokeObjectURL(url);
  };
}

/** Adapt Node worker_threads.Worker to the browser Worker API (postMessage, onmessage, terminate). */
function adaptNodeWorkerToBrowserWorker(nodeWorker: NodeWorker): Worker {
  type MessageListener = (ev: MessageEvent) => void;
  type ErrorListener = (ev: ErrorEvent) => void;
  const listeners: { message: MessageListener[]; error: ErrorListener[] } = {
    message: [],
    error: [],
  };
  let onmessageFn: ((ev: MessageEvent) => void) | null = null;
  let onerrorFn: ((ev: ErrorEvent) => void) | null = null;
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
  const adapter = {
    postMessage(data: unknown) {
      nodeWorker.postMessage(data);
    },
    terminate() {
      void nodeWorker.terminate();
    },
    get onmessage() {
      return onmessageFn;
    },
    set onmessage(fn: ((ev: MessageEvent) => void) | null) {
      onmessageFn = fn;
    },
    get onerror() {
      return onerrorFn;
    },
    set onerror(fn: ((ev: ErrorEvent) => void) | null) {
      onerrorFn = fn;
    },
    addEventListener(
      type: "message" | "error",
      listener: (ev: MessageEvent | ErrorEvent) => void,
    ) {
      (listeners[type] as ((ev: MessageEvent | ErrorEvent) => void)[]).push(
        listener,
      );
    },
    removeEventListener(
      type: "message" | "error",
      listener: (ev: MessageEvent | ErrorEvent) => void,
    ) {
      const list = listeners[type] as ((
        ev: MessageEvent | ErrorEvent,
      ) => void)[];
      const i = list.indexOf(listener);
      if (i !== -1) list.splice(i, 1);
    },
    dispatchEvent() {
      return true;
    },
  };
  return adapter as unknown as Worker;
}

const PatchedWorker = function (
  url: string | URL,
  _options?: WorkerOptions,
): Worker {
  const urlStr = typeof url === "string" ? url : url.toString();
  if (urlStr.startsWith("blob:nodejs-inline-")) {
    const id = urlStr.replace("blob:", "");
    const script = scriptStore.get(id);
    scriptStore.delete(id);
    if (script) {
      const nodeWorker = new NodeWorker(WORKER_IDB_WRAPPER_PATH, {
        workerData: { script },
        eval: false,
      });
      return adaptNodeWorkerToBrowserWorker(nodeWorker);
    }
  }
  throw new Error(
    "Vitest setup: only blob:nodejs-inline-* workers are supported (fiber-js inline workers). Use FIBER_RPC_URL for an external node.",
  );
};
(globalThis as unknown as { Worker: typeof Worker }).Worker =
  PatchedWorker as unknown as typeof Worker;
