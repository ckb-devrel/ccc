import satori from 'satori'
import type { renderTextParamsParser } from './render-text-params-parser'
import { base64ToArrayBuffer } from './utils/string'
import TurretRoadBoldBase64 from './fonts/TurretRoad-Bold.base64'
import TurretRoadMediumBase64 from './fonts/TurretRoad-Medium.base64'
import type { RenderElement } from './types/internal'

const TurretRoadMediumFont = base64ToArrayBuffer(TurretRoadMediumBase64)
const TurretRoadBoldFont = base64ToArrayBuffer(TurretRoadBoldBase64)

export interface RenderProps extends ReturnType<typeof renderTextParamsParser> {
  font?: {
    regular: ArrayBuffer
    italic: ArrayBuffer
    bold: ArrayBuffer
    boldItalic: ArrayBuffer
  }
}

export async function renderTextSvg(props: RenderProps) {
  const { regular, italic, bold, boldItalic } = props.font ?? {
    regular: TurretRoadMediumFont,
    italic: TurretRoadMediumFont,
    bold: TurretRoadBoldFont,
    boldItalic: TurretRoadBoldFont,
  }
  const children = props.items.reduce<RenderElement[]>((acc, item) => {
    const justifyContent = {
      left: 'flex-start',
      center: 'center',
      right: 'flex-end',
    }[item.parsedStyle.alignment]
    const el: RenderElement = {
      key: item.name,
      type: 'p',
      props: {
        children: [item.text],
        style: {
          ...item.style,
          display: 'flex',
          justifyContent,
          flexWrap: 'wrap',
          width: '100%',
          margin: 0,
        },
      },
    }
    if (item.parsedStyle.breakLine === 0 && acc[acc.length - 1]) {
      const lastEl = acc[acc.length - 1]
      el.type = 'span'
      delete el.props.style.width
      el.props.style.display = 'block'
      lastEl.props.children.push(el)
      return acc
    }
    acc.push(el)
    for (let i = 1; i < item.parsedStyle.breakLine; i++) {
      acc.push({
        key: `${item.name}${i}`,
        type: 'p',
        props: {
          children: ``,
          style: {
            height: '36px',
            margin: 0,
          },
        },
      })
    }
    return acc
  }, [])

  return satori(
    {
      key: 'container',
      type: 'div',
      props: {
        style: {
          display: 'flex',
          flexDirection: 'column',
          width: '100%',
          background: props.bgColor ?? '#000',
          color: '#fff',
          lineHeight: '150%',
          fontSize: '36px',
          padding: '20px',
          minHeight: '500px',
          textAlign: 'center',
        },
        children: [...children],
      },
    },
    {
      width: 500,
      fonts: [
        {
          name: 'TurretRoad',
          data: regular,
          weight: 400,
          style: 'normal',
        },
        {
          name: 'TurretRoad',
          data: bold,
          weight: 700,
          style: 'normal',
        },
        {
          name: 'TurretRoad',
          data: italic,
          weight: 400,
          style: 'italic',
        },
        {
          name: 'TurretRoad',
          data: boldItalic,
          weight: 700,
          style: 'italic',
        },
      ],
    },
  )
}
