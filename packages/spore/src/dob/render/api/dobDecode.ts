import { config } from '../config'
import type { DobDecodeResponse } from '../types'

export async function dobDecode(tokenKey: string): Promise<DobDecodeResponse> {
  const response = await fetch(config.dobDecodeServerURL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      id: 2,
      jsonrpc: '2.0',
      method: 'dob_decode',
      params: [tokenKey],
    }),
  })
  return response.json()
}
