import type { FileServerResult } from "../config.js";
import { hexToBase64 } from "./string.js";

/**
 * Detects MIME type from base64-encoded file header by examining file signatures
 * @param base64Header Base64-encoded file header (should be at least 32 bytes worth)
 * @returns The detected MIME type or null if not recognized
 */
function detectMimeTypeFromBase64Header(base64Header: string): string | null {
  // JPEG: starts with /9j/ (ffd8ff in base64)
  if (base64Header.startsWith("/9j/")) {
    return "image/jpeg";
  }

  // PNG: starts with iVBORw0KGgo (89504e47 in base64)
  if (base64Header.startsWith("iVBORw0KGgo")) {
    return "image/png";
  }

  // GIF: starts with R0lGOD (474946 in base64)
  if (base64Header.startsWith("R0lGOD")) {
    return "image/gif";
  }

  // WebP: starts with UklGR (RIFF in base64) and contains V0VCUA== ("WEBP" in base64)
  if (base64Header.startsWith("UklGRg") && base64Header.includes("V0VCUA")) {
    return "image/webp";
  }

  // BMP: starts with Qk0= (424d in base64)
  if (base64Header.startsWith("Qk0")) {
    return "image/bmp";
  }

  // SVG: starts with PHN2ZyA= (<svg in base64) or PD94bWwgPC (<?xml in base64)
  if (base64Header.startsWith("PHN2Zw") || base64Header.startsWith("PD94bWw")) {
    return "image/svg+xml";
  }

  // TIFF: starts with SUkqAA== (49492a00 in base64) or TU0AKg== (4d4d002a in base64)
  if (base64Header.startsWith("SUkqAA") || base64Header.startsWith("TU0AKg")) {
    return "image/tiff";
  }

  // ICO: starts with AAAEAA== (00000100 in base64)
  if (base64Header.startsWith("AAAAEAA")) {
    return "image/x-icon";
  }

  // AVIF: contains ZnR5cA== (ftyp in base64) and YXZpZg== (avif in base64)
  if (base64Header.includes("ZnR5cA") && base64Header.includes("YXZpZg")) {
    return "image/avif";
  }

  console.log("Unsupported MIME type", base64Header);
  return null;
}

/**
 * Detects the MIME type of an image from its hex-encoded content by examining file signatures
 * @param hexContent Hex-encoded image content
 * @returns The detected MIME type or null if not recognized
 */
export function detectImageMimeType(hexContent: string): string | null {
  // Skip if string is too short to contain a signature and content
  if (!hexContent || hexContent.length < 64) {
    return null;
  }

  // Extract just the file header (first 32 bytes should be enough for most formats)
  // and convert to lowercase for consistent comparison
  const header = hexContent.substring(0, 64).toLowerCase(); // 32 bytes = 64 hex chars

  // Convert hex to base64 for detection
  return detectMimeTypeFromBase64Header(hexToBase64(header));
}

/**
 * Detects the MIME type of an image from its base64-encoded content by examining file signatures
 * @param base64Content Base64-encoded image content
 * @returns The detected MIME type or null if not recognized
 */
export function detectImageMimeTypeFromBase64(
  base64Content: string,
): string | null {
  // Skip if string is too short to contain a signature and content
  if (!base64Content || base64Content.length < 44) {
    return null;
  }

  // Extract just the file header (first 32 bytes should be enough for most formats)
  // Base64 encoding: 32 bytes = 44 base64 characters (32 * 4/3 = 42.67, rounded up to 44)
  const header = base64Content.substring(0, 44);

  return detectMimeTypeFromBase64Header(header);
}

/**
 * Process file server result and convert to data URL with correct MIME type
 * @param result Result from file server
 * @returns Data URL or original string
 */
export function processFileServerResult(result: FileServerResult): string {
  if (typeof result === "string") {
    return result;
  }

  // Check if content_type is not an image type and try to detect the actual image type
  let contentType = result.content_type;
  if (!contentType.startsWith("image/") && result.content) {
    const mimeType = detectImageMimeTypeFromBase64(result.content);
    if (mimeType) {
      contentType = mimeType;
    }
  }

  return `data:${contentType};base64,${result.content}`;
}
