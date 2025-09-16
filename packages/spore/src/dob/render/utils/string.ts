import type {BtcFsURI, IpfsURI} from '../config'

export function parseStringToArray(str: string): string[] {
  const regex = /'([^']*)'/g
  return [...str.matchAll(regex)].map((match) => match[1])
}

export function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binaryString = atob(base64)

  const uint8Array = new Uint8Array(binaryString.length)
  for (let i = 0; i < binaryString.length; i++) {
    uint8Array[i] = binaryString.charCodeAt(i)
  }

  return uint8Array.buffer
}

export function isBtcFs(uri: string): uri is BtcFsURI {
  return uri.startsWith('btcfs://')
}

export function isIpfs(uri: string): uri is IpfsURI {
  return uri.startsWith('ipfs://')
}

export function hexToBase64(hexstring: string): string {
  const str = hexstring
    .match(/\w{2}/g)
    ?.map((a) => String.fromCharCode(parseInt(a, 16)))
    .join('')
  return str ? btoa(str) : ''
}
