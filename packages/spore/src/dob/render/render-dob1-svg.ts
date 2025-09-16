import { type INode, stringify } from 'svgson'
import satori from 'satori'
import { svgToBase64 } from './svg-to-base64'
import { base64ToArrayBuffer } from './utils/string'
import SpaceGroteskBoldBase64 from './fonts/SpaceGrotesk-Bold.base64'

export async function renderDob1Svg(nodePromise: Promise<INode>) {
  const node = await nodePromise
  const str = stringify(node)
  const base64 = await svgToBase64(str)
  const spaceGroteskBoldFont = base64ToArrayBuffer(SpaceGroteskBoldBase64)
  const width = parseInt(node.attributes.width, 10) || 500
  const height = parseInt(node.attributes.height, 10) || 500

  return satori(
    {
      key: 'container',
      type: 'div',
      props: {
        style: {
          display: 'flex',
          width: `${width}px`,
          height: `${width}px`,
        },
        children: [
          {
            type: 'img',
            props: {
              src: base64,
              width,
              height,
              style: {
                width: `${width}px`,
                height: `${height}px`,
              },
            },
          },
        ],
      },
    },
    {
      width,
      height,
      fonts: [
        {
          name: 'SpaceGrotesk',
          data: spaceGroteskBoldFont,
          weight: 700,
        },
      ],
    },
  )
}
