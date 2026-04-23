import { createServer, type Server } from "node:http";

/** Minimal interface required by the RPC bridge (satisfied by fiber-js Fiber). */
export interface FiberLike {
  invokeCommand(name: string, args?: unknown[]): Promise<unknown>;
  stop(): Promise<void>;
}

export interface RpcBridgeOptions {
  /** Add CORS headers (Access-Control-Allow-Origin: *). Default: false. */
  cors?: boolean;
  /** Log every RPC request and response to stdout. Default: false. */
  verbose?: boolean;
}

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

/**
 * Create an HTTP server that exposes a JSON-RPC 2.0 interface over
 * fiber.invokeCommand(). POST / is the only accepted endpoint.
 */
export function createRpcServer(
  fiber: FiberLike,
  options: RpcBridgeOptions = {},
): Server {
  const { cors = false, verbose = false } = options;

  return createServer((req, res) => {
    if (cors && req.method === "OPTIONS") {
      res.writeHead(204, CORS_HEADERS);
      res.end();
      return;
    }
    if (req.method !== "POST" || req.url !== "/") {
      res.writeHead(404, cors ? CORS_HEADERS : {});
      res.end();
      return;
    }

    let body = "";
    req.setEncoding("utf8");
    req.on("data", (chunk: string) => {
      body += chunk;
    });
    req.on("end", () => {
      void (async () => {
        let id: number | undefined;
        const headers: Record<string, string> = {
          "Content-Type": "application/json",
          ...(cors ? CORS_HEADERS : {}),
        };
        try {
          const payload = JSON.parse(body) as {
            method: string;
            params?: unknown[];
            id: number;
          };
          const { method, params = [], id: payloadId } = payload;
          id = payloadId;
          if (verbose) console.log("[fiber-rpc] →", method, params);
          const result = await fiber.invokeCommand(method, params);
          if (verbose) console.log("[fiber-rpc] ←", JSON.stringify(result));
          res.writeHead(200, headers);
          res.end(JSON.stringify({ jsonrpc: "2.0", result, id }));
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          res.writeHead(200, headers);
          res.end(
            JSON.stringify({
              jsonrpc: "2.0",
              error: { code: -32603, message },
              id: id ?? 0,
            }),
          );
        }
      })();
    });
  });
}

/**
 * Start the server on preferredPort, retrying up to maxRetries times on
 * EADDRINUSE. Resolves to the actual port that was bound.
 */
export function listenRpcServer(
  server: Server,
  preferredPort: number,
  host = "127.0.0.1",
  maxRetries = 10,
): Promise<number> {
  return new Promise((resolve, reject) => {
    const tryPort = (port: number) => {
      server.removeAllListeners("error");
      server.removeAllListeners("listening");
      server.once("error", (err: NodeJS.ErrnoException) => {
        if (err.code === "EADDRINUSE" && port < preferredPort + maxRetries) {
          tryPort(port + 1);
        } else {
          reject(
            err.code === "EADDRINUSE"
              ? new Error(
                  `FiberRuntime: could not bind RPC server to any port in ` +
                    `[${preferredPort}..${preferredPort + maxRetries - 1}]. ` +
                    `Stop other fiber-node processes or choose a different port.`,
                )
              : err,
          );
        }
      });
      server.once("listening", () => resolve(port));
      server.listen(port, host);
    };
    tryPort(preferredPort);
  });
}

/** Gracefully close a server (resolves immediately if null). */
export function closeRpcServer(server: Server | null): Promise<void> {
  if (!server) return Promise.resolve();
  return new Promise((resolve) => server.close(() => resolve()));
}
