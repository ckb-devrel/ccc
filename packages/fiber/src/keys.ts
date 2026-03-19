function camelToSnakeKey(s: string): string {
  return s.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);
}

function snakeToCamelKey(s: string): string {
  return s.replace(/_([a-z])/g, (_: string, c: string) => c.toUpperCase());
}

function convertKeys(value: unknown, keyFn: (key: string) => string): unknown {
  if (value === null || value === undefined) {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map((item) => convertKeys(item, keyFn));
  }
  if (typeof value === "object" && value.constructor === Object) {
    const obj = value as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(obj)) {
      const newKey = keyFn(key);
      out[newKey] = convertKeys(obj[key], keyFn);
    }
    return out;
  }
  return value;
}

// Convert object keys from camelCase to snake_case (recursive). Used when sending params to Fiber RPC.
export function camelToSnake<T = unknown>(value: T): unknown {
  return convertKeys(value, camelToSnakeKey);
}

// Convert object keys from snake_case to camelCase (recursive). Used when receiving results from Fiber RPC.
export function snakeToCamel<T = unknown>(value: T): unknown {
  return convertKeys(value, snakeToCamelKey);
}
