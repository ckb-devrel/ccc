/**
 * Serializes JavaScript values for Fiber JSON-RPC: bigint and number become hex strings.
 * Other values are passed through; objects and arrays are traversed recursively.
 */

export function serializeRpcParams(value: unknown): unknown {
  if (typeof value === "bigint" || typeof value === "number") {
    return "0x" + value.toString(16);
  }
  if (Array.isArray(value)) {
    return value.map(serializeRpcParams);
  }
  if (value !== null && typeof value === "object") {
    const obj = value as Record<string, unknown>;
    if (Object.keys(obj).length === 0) return obj;
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(obj)) {
      out[key] = serializeRpcParams(obj[key]);
    }
    return out;
  }
  return value;
}
