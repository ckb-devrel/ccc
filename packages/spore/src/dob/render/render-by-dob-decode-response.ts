import type { DobDecodeResult, RenderPartialOutput } from './types'
import { traitsParser } from './traits-parser'
import { renderTextParamsParser } from './render-text-params-parser'
import type { RenderProps } from './render-text-svg'
import { renderTextSvg } from './render-text-svg'
import { renderImageSvg } from './render-image-svg'
import { renderDob1Svg } from './render-dob1-svg'
import { Key } from './constants/key'

export function renderByDobDecodeResponse(
  dob0Data: DobDecodeResult | string,
  props?: Pick<RenderProps, 'font'> & {
    outputType?: 'svg'
  },
) {
  if (typeof dob0Data === 'string') {
    dob0Data = JSON.parse(dob0Data) as DobDecodeResult
  }
  if (typeof dob0Data.render_output === 'string') {
    dob0Data.render_output = JSON.parse(
      dob0Data.render_output,
    ) as RenderPartialOutput[]
  }
  const { traits, indexVarRegister } = traitsParser(dob0Data.render_output)
  for (const trait of traits) {
    if (trait.name === 'prev.type' && trait.value === 'image') {
      return renderImageSvg(traits)
    }
    // TODO: multiple images
    if (trait.name === Key.Image && trait.value instanceof Promise) {
      return renderDob1Svg(trait.value)
    }
  }
  const renderOptions = renderTextParamsParser(traits, indexVarRegister)
  return renderTextSvg({ ...renderOptions, font: props?.font })
}
