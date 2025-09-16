import { describe, expect, it } from 'vitest'
import {
  DEFAULT_TEMPLATE,
  renderTextParamsParser,
} from '../render-text-params-parser'
import { traitsParser } from '../traits-parser'
import { Key } from '../constants/key'
import { DEFAULT_STYLE } from '../style-parser'

describe('function renderTextParamsParser', () => {
  it('case: default template', () => {
    const { traits, indexVarRegister } = traitsParser([
      {
        name: 'Key',
        traits: [
          {
            String: 'Value',
          },
        ],
      },
    ])
    const params = renderTextParamsParser(traits, indexVarRegister, {
      defaultTemplate: DEFAULT_TEMPLATE,
    })
    expect(params.items[0].text).toEqual('Key: Value')
  })

  it('case: customized default template by options', () => {
    const { traits, indexVarRegister } = traitsParser([
      {
        name: 'Key',
        traits: [
          {
            String: 'Value',
          },
        ],
      },
    ])
    const params = renderTextParamsParser(traits, indexVarRegister, {
      defaultTemplate: '%v',
    })
    expect(params.items[0].text).toEqual('Value')
  })

  it('case: customized default template by global traits', () => {
    const { traits, indexVarRegister } = traitsParser([
      {
        name: `${Key.Prev}<ddd %v>`,
        traits: [
          {
            String: '#fff',
          },
        ],
      },
      {
        name: 'Key',
        traits: [
          {
            String: 'Value',
          },
        ],
      },
    ])
    const params = renderTextParamsParser(traits, indexVarRegister)
    expect(params.items[0].text).toEqual('ddd Value')
  })

  it('case: customized default template by current traits', () => {
    const { traits, indexVarRegister } = traitsParser([
      {
        name: 'Key<%k %k %v>',
        traits: [
          {
            String: 'Value',
          },
        ],
      },
    ])
    const params = renderTextParamsParser(traits, indexVarRegister)
    expect(params.items[0].text).toEqual('Key Key Value')
  })

  it('case: customized default template and style by global traits', () => {
    const { traits, indexVarRegister } = traitsParser([
      {
        name: `${Key.Prev}<ddd %v>`,
        traits: [
          {
            String: '<#ff0>',
          },
        ],
      },
      {
        name: 'Key',
        traits: [
          {
            String: 'Value',
          },
        ],
      },
      {
        name: 'Key2<%k %k %v>',
        traits: [
          {
            String: 'Value<#f00>',
          },
        ],
      },
    ])
    const params = renderTextParamsParser(traits, indexVarRegister)
    expect(params.items[0].text).toEqual('ddd Value')
    const expectStyle = {
      ...DEFAULT_STYLE,
      color: '#ff0',
    }
    expect(params.items[0].parsedStyle).toEqual(expectStyle)
    expect(params.items[1].text).toEqual('Key2 Key2 Value')
    const expectStyle2 = {
      ...DEFAULT_STYLE,
      color: '#f00',
    }
    expect(params.items[1].parsedStyle).toEqual(expectStyle2)
  })

  it('case: customized default template and style by current traits', () => {
    const { traits, indexVarRegister } = traitsParser([
      {
        name: 'Key<%k %k %v>',
        traits: [
          {
            String: 'Value<#f00>',
          },
        ],
      },
    ])
    const params = renderTextParamsParser(traits, indexVarRegister)
    expect(params.items[0].text).toEqual('Key Key Value')
    const expectStyle = {
      ...DEFAULT_STYLE,
      color: '#f00',
    }
    expect(params.items[0].parsedStyle).toEqual(expectStyle)
  })
})
