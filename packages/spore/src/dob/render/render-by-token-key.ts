import { dobDecode } from './api/dobDecode'
import type { RenderProps } from './render-text-svg'
import { renderByDobDecodeResponse } from './render-by-dob-decode-response'

export async function renderByTokenKey(
  tokenKey: string,
  options?: Pick<RenderProps, 'font'> & {
    outputType?: 'svg'
  },
) {
  const dobDecodeResponse = await dobDecode(tokenKey)
  return renderByDobDecodeResponse(dobDecodeResponse.result, options)
}
