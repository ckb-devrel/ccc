import type { FileServerResult } from '../config'
import { hexToBase64 } from './string'

/**
 * Detects the MIME type of an image from its hex-encoded content by examining file signatures
 * @param hexContent Hex-encoded image content
 * @returns The detected MIME type or null if not recognized
 */
export function detectImageMimeType(hexContent: string): string | null {
  // Skip if string is too short to contain a signature and content
  if (!hexContent || hexContent.length < 64) {
    return null
  }

  // Extract just the file header (first 32 bytes should be enough for most formats)
  // and convert to lowercase for consistent comparison
  const header = hexContent.substring(0, 64).toLowerCase() // 32 bytes = 64 hex chars
  
  // JPEG: starts with ffd8ff
  if (header.startsWith('ffd8ff')) {
    return 'image/jpeg'
  }
  
  // PNG: starts with 89504e47 (‰PNG)
  if (header.startsWith('89504e47')) {
    return 'image/png'
  }
  
  // GIF: starts with 474946 (GIF)
  if (header.startsWith('474946')) {
    return 'image/gif'
  }
  
  // WebP: RIFF....WEBP
  if (header.startsWith('52494646') && header.substring(16, 24) === '57454250') {
    return 'image/webp'
  }
  
  // BMP: starts with 424d (BM)
  if (header.startsWith('424d')) {
    return 'image/bmp'
  }

  // SVG: starts with <svg or <?xml
  if (header.startsWith('3c737667') || header.startsWith('3c3f786d6c')) {
    return 'image/svg+xml'
  }
  
  // TIFF: starts with 49492a00 (Intel) or 4d4d002a (Motorola)
  if (header.startsWith('49492a00') || header.startsWith('4d4d002a')) {
    return 'image/tiff'
  }
  
  // ICO: starts with 00000100
  if (header.startsWith('00000100')) {
    return 'image/x-icon'
  }

  // AVIF: ftyp....avif
  if (header.includes('66747970') && header.includes('61766966')) {
    return 'image/avif'
  }
  
  return null
}

/**
 * Process file server result and convert to data URL with correct MIME type
 * @param result Result from file server
 * @returns Data URL or original string
 */
export function processFileServerResult(result: FileServerResult): string {
  if (typeof result === 'string') {
    return result
  }
  
  // Check if content_type is not an image type and try to detect the actual image type
  let contentType = result.content_type
  if (!contentType.startsWith('image/') && result.content) {
    const mimeType = detectImageMimeType(result.content)
    if (mimeType) {
      contentType = mimeType
    }
  }
  
  return `data:${contentType};base64,${hexToBase64(result.content)}`
}