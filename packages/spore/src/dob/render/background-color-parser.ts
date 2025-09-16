import type { ParsedTrait } from './traits-parser'
import { Key } from './constants/key'

export function getBackgroundColorByTraits(
  traits: ParsedTrait[],
): ParsedTrait | undefined {
  return traits.find((trait) => trait.name === Key.BgColor)
}

export function backgroundColorParser(
  traits: ParsedTrait[],
  options?: {
    defaultColor?: string
  },
): string {
  const bgColorTrait = getBackgroundColorByTraits(traits)
  if (bgColorTrait) {
    if (typeof bgColorTrait.value === 'string') {
      if (
        bgColorTrait.value.startsWith('#(') &&
        bgColorTrait.value.endsWith(')')
      ) {
        return bgColorTrait.value.replace('#(', 'linear-gradient(')
      }
      return bgColorTrait.value
    }
  }
  return options?.defaultColor || '#000'
}
