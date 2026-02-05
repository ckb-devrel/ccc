/**
 * Error thrown when a Fiber RPC call fails (server error or method not found).
 */
export class RPCError extends Error {
  constructor(
    public readonly error: { code: number; message: string; data?: unknown },
  ) {
    super(`[RPC Error ${error.code}] ${error.message}`);
    this.name = "RPCError";
  }
}
