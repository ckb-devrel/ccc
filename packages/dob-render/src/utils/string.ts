import type { BtcFsURI, CkbFsURI, IpfsURI } from "../types/query.js";

export function parseStringToArray(str: string): string[] {
  const regex = /'([^']*)'/g;
  return [...str.matchAll(regex)].map((match) => match[1]);
}

// Environment-agnostic base64 decoding
export function base64Decode(base64: string): string {
  if (typeof window !== "undefined" && typeof window.atob === "function") {
    // Browser environment
    return window.atob(base64);
  } else if (typeof Buffer !== "undefined") {
    // Node.js environment
    return Buffer.from(base64, "base64").toString("binary");
  } else {
    // Fallback implementation
    const chars =
      "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    let result = "";
    let i = 0;

    base64 = base64.replace(/[^A-Za-z0-9+/]/g, "");

    while (i < base64.length) {
      const encoded1 = chars.indexOf(base64.charAt(i++));
      const encoded2 = chars.indexOf(base64.charAt(i++));
      const encoded3 = chars.indexOf(base64.charAt(i++));
      const encoded4 = chars.indexOf(base64.charAt(i++));

      const bitmap =
        (encoded1 << 18) | (encoded2 << 12) | (encoded3 << 6) | encoded4;

      result += String.fromCharCode((bitmap >> 16) & 255);
      if (encoded3 !== 64) result += String.fromCharCode((bitmap >> 8) & 255);
      if (encoded4 !== 64) result += String.fromCharCode(bitmap & 255);
    }

    return result;
  }
}

export function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binaryString = base64Decode(base64);

  const uint8Array = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    uint8Array[i] = binaryString.charCodeAt(i);
  }

  return uint8Array.buffer;
}

export function isBtcFs(uri: string): uri is BtcFsURI {
  return uri.startsWith("btcfs://");
}

export function isIpfs(uri: string): uri is IpfsURI {
  return uri.startsWith("ipfs://");
}

export function isCkbFs(uri: string): uri is CkbFsURI {
  return uri.startsWith("ckbfs://");
}

export function isUrl(uri: string): boolean {
  return uri.startsWith("https://") || uri.startsWith("http://");
}

// Environment-agnostic base64 encoding
export function base64Encode(str: string): string {
  if (typeof window !== "undefined" && typeof window.btoa === "function") {
    // Browser environment
    return window.btoa(str);
  } else if (typeof Buffer !== "undefined") {
    // Node.js environment
    return Buffer.from(str, "binary").toString("base64");
  } else {
    // Fallback implementation
    const chars =
      "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    let result = "";
    let i = 0;

    while (i < str.length) {
      const a = str.charCodeAt(i++);
      const b = i < str.length ? str.charCodeAt(i++) : 0;
      const c = i < str.length ? str.charCodeAt(i++) : 0;

      const bitmap = (a << 16) | (b << 8) | c;

      result += chars.charAt((bitmap >> 18) & 63);
      result += chars.charAt((bitmap >> 12) & 63);
      result += i - 2 < str.length ? chars.charAt((bitmap >> 6) & 63) : "=";
      result += i - 1 < str.length ? chars.charAt(bitmap & 63) : "=";
    }

    return result;
  }
}

export function hexToBase64(hexstring: string): string {
  const str = hexstring
    .match(/\w{2}/g)
    ?.map((a) => String.fromCharCode(parseInt(a, 16)))
    .join("");
  return str ? base64Encode(str) : "";
}
