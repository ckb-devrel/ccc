import {
  CodecBaseParseError,
  CodecExecuteError,
  isCodecExecuteError,
} from "./error.js";

export function assertBufferLength(
  buf: { byteLength: number },
  length: number,
): void {
  if (buf.byteLength !== length) {
    throw new Error(
      `Invalid buffer length: ${buf.byteLength}, should be ${length}`,
    );
  }
}

export function assertMinBufferLength(
  buf: { byteLength: number },
  length: number,
): void {
  if (buf.byteLength < length) {
    throw new Error(
      `Invalid buffer length: ${buf.byteLength}, should be at least ${length}`,
    );
  }
}

export function isObjectLike(x: unknown): x is Record<string, unknown> {
  if (!x) return false;
  return typeof x === "object";
}

export function trackCodeExecuteError<T>(
  path: string | number | symbol,
  fn: () => T,
): T {
  try {
    return fn();
  } catch (e) {
    const readableError = isCodecExecuteError(e)
      ? e
      : new CodecExecuteError(e as CodecBaseParseError);
    readableError.updateKey(path);
    throw readableError;
  }
}
