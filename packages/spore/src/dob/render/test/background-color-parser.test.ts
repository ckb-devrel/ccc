import { describe, expect, it } from 'vitest'
import {
  backgroundColorParser,
  getBackgroundColorByTraits,
} from '../background-color-parser'
import { traitsParser } from '../traits-parser'
import { Key } from '../constants/key'

describe('function backgroundColorParser', async () => {
  it('case: normal', () => {
    const { traits } = traitsParser([
      {
        name: Key.BgColor,
        traits: [
          {
            String: `#FFF`,
          },
        ],
      },
    ])
    expect(backgroundColorParser(traits)).toEqual(
      getBackgroundColorByTraits(traits),
    )
  })

  it('case: not found and default', () => {
    const { traits } = traitsParser([])
    const defaultColor = '#fff'
    expect(backgroundColorParser(traits, { defaultColor })).toEqual(
      defaultColor,
    )
  })

  it('case: linear-gradient', () => {
    const { traits } = traitsParser([
      {
        name: Key.BgColor,
        traits: [
          {
            String: `#(45deg, blue, pink)`,
          },
        ],
      },
    ])
    expect(backgroundColorParser(traits)).toEqual(
      'linear-gradient(45deg, blue, pink)',
    )
  })
})
