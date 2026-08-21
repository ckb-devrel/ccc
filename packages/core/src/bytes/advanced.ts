/**
 * Represents the possible encoding formats for converting bytes.
 * @public
 */
export type BytesFromEncoding =
  | "utf8" // UTF-8 encoding
  | "base64" // Base64 encoding
  | "base64url" // Base64 URL encoding
  | "hex"; // Hexadecimal encoding
