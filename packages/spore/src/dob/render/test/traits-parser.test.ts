import { describe, expect, it } from 'vitest'
import { traitsParser } from '../traits-parser'

describe('function traitsParser', async () => {
  it('case: var', () => {
    const varName = 'var'
    const value = 3
    const traits = [
      {
        name: 'var',
        traits: [
          {
            String: `${value}<_>`,
          },
        ],
      },
    ]

    const { indexVarRegister } = traitsParser(traits)
    expect(indexVarRegister[varName]).toEqual(value)
  })

  it('case: array index', () => {
    const varName = 'var'
    const value = 3
    const { traits, indexVarRegister } = traitsParser([
      {
        name: varName,
        traits: [
          {
            String: `${value}<_>`,
          },
        ],
      },
      {
        name: 'prev.bgcolor',
        traits: [
          {
            String: `(%${varName}):['#FFFF00', '#0000FF', '#FF00FF', '#FF0000', '#000000']`,
          },
        ],
      },
    ])
    const trait = traits.find(({ name }) => name === 'prev.bgcolor')
    expect(indexVarRegister[varName]).toEqual(value)
    expect(trait?.value).toEqual('#FF0000')
  })

  it('case: array with over index', () => {
    const varName = 'var'
    const value = 10
    const { traits, indexVarRegister } = traitsParser([
      {
        name: varName,
        traits: [
          {
            String: `${value}<_>`,
          },
        ],
      },
      {
        name: 'prev.bgcolor',
        traits: [
          {
            String: `(%${varName}):['#FFFF00', '#0000FF', '#FF00FF', '#FF0000', '#000000']`,
          },
        ],
      },
    ])
    const trait = traits.find(({ name }) => name === 'prev.bgcolor')
    expect(indexVarRegister[varName]).toEqual(value)
    expect(trait?.value).toEqual('#FFFF00')
  })

  it('case: number', () => {
    const key = 'data'
    const value = 1
    const { traits } = traitsParser([
      {
        name: key,
        traits: [
          {
            Number: value,
          },
        ],
      },
    ])
    const trait = traits.find(({ name }) => name === key)
    expect(trait?.value).toEqual(value)
  })
})
