export function errorMessage(cause: unknown): string {
  if (cause instanceof Error) {
    const message = cause.message || cause.name;
    return cause.name && cause.name !== "Error"
      ? `${cause.name}: ${message}`
      : message;
  }

  if (typeof cause === "string") {
    return cause;
  }

  if (
    typeof ErrorEvent !== "undefined" &&
    cause instanceof ErrorEvent &&
    cause.error !== undefined
  ) {
    return errorMessage(cause.error);
  }

  if (typeof cause === "object" && cause !== null) {
    if (
      "message" in cause &&
      typeof cause.message === "string" &&
      cause.message
    ) {
      const name =
        "name" in cause && typeof cause.name === "string" ? cause.name : "";
      return name ? `${name}: ${cause.message}` : cause.message;
    }

    try {
      const serialized = JSON.stringify(cause);
      if (serialized && serialized !== "{}") {
        return serialized;
      }
    } catch {
      // Fall through to the browser's string representation.
    }
  }

  const message = String(cause);
  return message && message !== "[object Object]"
    ? message
    : "Unknown browser error";
}
