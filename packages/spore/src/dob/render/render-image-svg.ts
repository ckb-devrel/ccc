import satori from 'satori'
import type { ParsedTrait } from './traits-parser'
import { config } from './config'
import { backgroundColorParser } from './background-color-parser'
import { processFileServerResult } from './utils/mime'
import { isBtcFs, isIpfs } from './utils/string'

export async function renderImageSvg(traits: ParsedTrait[]): Promise<string> {
  const prevBg = traits.find((trait) => trait.name === 'prev.bg')
  const bgColor = backgroundColorParser(traits, { defaultColor: '#FFFFFF00' })

  let bgImage = ''
  if (prevBg?.value && typeof prevBg.value === 'string') {
    if (isBtcFs(prevBg.value)) {
      const btcFsResult = await config.queryBtcFsFn(prevBg.value)
      bgImage = processFileServerResult(btcFsResult)
    } else if (isIpfs(prevBg.value)) {
      const ipfsFsResult = await config.queryIpfsFn(prevBg.value)
      bgImage = processFileServerResult(ipfsFsResult)
    } else if (prevBg.value.startsWith('https://')) {
      bgImage = prevBg.value
    }
  }

  return satori(
    {
      key: 'container',
      type: 'div',
      props: {
        style: {
          display: 'flex',
          width: '500px',
          background: bgColor ?? '#000',
          color: '#fff',
          height: '500px',
          justifyContent: 'center',
          alignItems: 'center',
          overflow: 'hidden',
        },
        children: [
          bgImage
            ? {
                key: 'bg_image',
                type: 'img',
                props: {
                  src: bgImage,
                  style: {
                    objectFit: 'contain',
                    maxWidth: '100%',
                    maxHeight: '100%',
                  },
                },
              }
            : null,
        ],
      },
    },
    { width: 500, height: 500, fonts: [] },
  )
}
