export enum ParsedStyleFormat {
  Bold = 'bold',
  Italic = 'italic',
  Strikethrough = 'strikethrough',
  Underline = 'underline',
}

export enum ParsedStyleAlignment {
  Left = 'left',
  Center = 'center',
  Right = 'right',
}

export interface ParsedStyle {
  color: string
  format: ParsedStyleFormat[]
  alignment: ParsedStyleAlignment
  breakLine: number
}

export const DEFAULT_STYLE: ParsedStyle = {
  color: '#fff',
  format: [],
  alignment: ParsedStyleAlignment.Left,
  breakLine: 1,
} as const

export function styleParser(
  str: string,
  options?: {
    baseStyle: ParsedStyle
  },
) {
  let text = str
  const jsonResult = options?.baseStyle || { ...DEFAULT_STYLE }

  if (text.startsWith('<') && text.endsWith('>')) {
    text = text.substring(1, str.length - 1)
  }

  const colorMatch6 = /#([0-9a-fA-F]{6})/.exec(text)
  if (colorMatch6) {
    jsonResult.color = `#${colorMatch6[1]}`
    text = text.replace(/#([0-9a-fA-F]{6})/, '')
  }

  const colorMatch3 = /#([0-9a-fA-F]{3})/.exec(text)
  if (colorMatch3) {
    jsonResult.color = `#${colorMatch3[1]}`
    text = text.replace(/#([0-9a-fA-F]{3})/, '')
  }

  const formatMatch = /\*([bisu]+)/.exec(text)
  if (formatMatch) {
    jsonResult.format = formatMatch[1]
      .split('')
      .map((char) => {
        switch (char) {
          case 'b':
            return ParsedStyleFormat.Bold
          case 'i':
            return ParsedStyleFormat.Italic
          case 's':
            return ParsedStyleFormat.Strikethrough
          case 'u':
            return ParsedStyleFormat.Underline
          default:
            return null
        }
      })
      .filter((char) => char)
      .map((token) => token!)
    text = text.replace(/\*([bisu]+)/, '')
  }

  const alignmentMatch = /@(l|c|r)/.exec(text)
  if (alignmentMatch) {
    switch (alignmentMatch[1]) {
      case 'l':
        jsonResult.alignment = ParsedStyleAlignment.Left
        break
      case 'c':
        jsonResult.alignment = ParsedStyleAlignment.Center
        break
      case 'r':
        jsonResult.alignment = ParsedStyleAlignment.Right
        break
    }
    text = text.replace(/@(l|c|r)/, '')
  }

  const traitsMatch = /&/.exec(text)
  if (traitsMatch) {
    text = text.replace(/&/, '')
    jsonResult.breakLine = 0
  }

  const breakLineMatch = text.match(/~/g)
  if (breakLineMatch) {
    jsonResult.breakLine = breakLineMatch.length + 1
  }

  return jsonResult
}
