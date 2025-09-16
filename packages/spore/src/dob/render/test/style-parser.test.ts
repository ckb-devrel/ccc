import { describe, expect, it } from 'vitest'
import {
  DEFAULT_STYLE,
  ParsedStyleAlignment,
  ParsedStyleFormat,
  styleParser,
} from '../style-parser'

describe('function styleParser', async () => {
  it('case: empty string', () => {
    expect(styleParser('')).toEqual(DEFAULT_STYLE)
  })

  it('case: "#fff"', () => {
    const color = '#fff'
    const expectStyle = {
      ...DEFAULT_STYLE,
      color,
    }
    expect(styleParser(color)).toEqual(expectStyle)
  })

  it('case: "#ffffff"', () => {
    const color = '#ffffff'
    const expectStyle = {
      ...DEFAULT_STYLE,
      color,
    }
    expect(styleParser(color)).toEqual(expectStyle)
  })

  it('case: "<#ffffff>"', () => {
    const color = '#ffffff'
    const expectStyle = {
      ...DEFAULT_STYLE,
      color,
    }
    expect(styleParser(color)).toEqual(expectStyle)
  })

  it('case: "<#fff>"', () => {
    const color = '#fff'
    const expectStyle = {
      ...DEFAULT_STYLE,
      color,
    }
    expect(styleParser(color)).toEqual(expectStyle)
  })

  it('case: "<#fff@c>"', () => {
    const color = '#fff'
    const expectStyle = {
      ...DEFAULT_STYLE,
      color,
      alignment: 'center',
    }
    expect(styleParser(`<${color}@c>`)).toEqual(expectStyle)
  })

  it('case: "<#fff@l>"', () => {
    const color = '#fff'
    const expectStyle = {
      ...DEFAULT_STYLE,
      color,
      alignment: 'left',
    }
    expect(styleParser(`<${color}@l>`)).toEqual(expectStyle)
  })

  it('case: "<#fff@r>"', () => {
    const color = '#fff'
    const expectStyle = {
      ...DEFAULT_STYLE,
      color,
      alignment: 'right',
    }
    expect(styleParser(`<${color}@r>`)).toEqual(expectStyle)
  })

  it('case: "<#fff*b>"', () => {
    const color = '#fff'
    const expectStyle = {
      ...DEFAULT_STYLE,
      color,
      format: [ParsedStyleFormat.Bold],
    }
    expect(styleParser(`<${color}*b>`)).toEqual(expectStyle)
  })

  it('case: "<#fff*bu>"', () => {
    const color = '#fff'
    const expectStyle = {
      ...DEFAULT_STYLE,
      color,
      format: [ParsedStyleFormat.Bold, ParsedStyleFormat.Underline],
    }
    expect(styleParser(`<${color}*bu>`)).toEqual(expectStyle)
  })

  it('case: "<#fff*bui>"', () => {
    const color = '#fff'
    const expectStyle = {
      ...DEFAULT_STYLE,
      color,
      format: [
        ParsedStyleFormat.Bold,
        ParsedStyleFormat.Underline,
        ParsedStyleFormat.Italic,
      ],
    }
    expect(styleParser(`<${color}*bui>`)).toEqual(expectStyle)
  })

  it('case: "<#fff*buis>"', () => {
    const color = '#fff'
    const expectStyle = {
      ...DEFAULT_STYLE,
      color,
      format: [
        ParsedStyleFormat.Bold,
        ParsedStyleFormat.Underline,
        ParsedStyleFormat.Italic,
        ParsedStyleFormat.Strikethrough,
      ],
    }
    expect(styleParser(`<${color}*buis>`)).toEqual(expectStyle)
  })

  it('case: "<#fff*bis>"', () => {
    const color = '#fff'
    const expectStyle = {
      ...DEFAULT_STYLE,
      color,
      format: [
        ParsedStyleFormat.Bold,
        ParsedStyleFormat.Italic,
        ParsedStyleFormat.Strikethrough,
      ],
    }
    expect(styleParser(`<${color}*bis>`)).toEqual(expectStyle)
  })

  it('case: "<#fff*is>"', () => {
    const color = '#fff'
    const expectStyle = {
      ...DEFAULT_STYLE,
      color,
      format: [ParsedStyleFormat.Italic, ParsedStyleFormat.Strikethrough],
    }
    expect(styleParser(`<${color}*is>`)).toEqual(expectStyle)
  })

  it('case: "<#fff*s>"', () => {
    const color = '#fff'
    const expectStyle = {
      ...DEFAULT_STYLE,
      color,
      format: [ParsedStyleFormat.Strikethrough],
    }
    expect(styleParser(`<${color}*s>`)).toEqual(expectStyle)
  })

  it('case: "<#fff&>"', () => {
    const color = '#fff'
    const expectStyle = {
      ...DEFAULT_STYLE,
      color,
      breakLine: 0,
    }
    expect(styleParser(`<${color}&>`)).toEqual({
      ...expectStyle,
    })
  })

  it('case: "<#fff&~>"', () => {
    const color = '#fff'
    const expectStyle = {
      ...DEFAULT_STYLE,
      color,
      breakLine: 2,
    }
    expect(styleParser(`<${color}&~>`)).toEqual({
      ...expectStyle,
    })
  })

  it('case: "<#fff~~>"', () => {
    const color = '#fff'
    const expectStyle = {
      ...DEFAULT_STYLE,
      color,
      breakLine: 3,
    }
    expect(styleParser(`<${color}~~>`)).toEqual({
      ...expectStyle,
    })
  })

  it('case: "<~~#fff>"', () => {
    const color = '#fff'
    const expectStyle = {
      ...DEFAULT_STYLE,
      color,
      breakLine: 3,
    }
    expect(styleParser(`<~~${color}>`)).toEqual({
      ...expectStyle,
    })
  })

  it('case: "<@r#fff>"', () => {
    const color = '#fff'
    const expectStyle = {
      ...DEFAULT_STYLE,
      color,
      alignment: ParsedStyleAlignment.Right,
    }
    expect(styleParser(`<@r${color}>`)).toEqual({
      ...expectStyle,
    })
  })
})
