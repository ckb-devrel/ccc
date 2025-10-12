import { Key } from "../config/constants.js";
import { renderTextParamsParser } from "../core/parsers/textParamsParser.js";
import { traitsParser } from "../core/parsers/traitsParser.js";
import { renderDob1Svg } from "../core/renderers/dob1Render.js";
import { renderImageSvg } from "../core/renderers/imageRender.js";
import type { RenderProps } from "../core/renderers/textRender.js";
import { renderTextSvg } from "../core/renderers/textRender.js";
import type { RenderOutput } from "../types/external.js";

export function renderByDobDecodeResponse(
  renderOutput: RenderOutput | string,
  props?: Pick<RenderProps, "font"> & {
    outputType?: "svg";
  },
) {
  let renderData: RenderOutput;
  if (typeof renderOutput === "string") {
    renderData = JSON.parse(renderOutput) as RenderOutput;
  } else {
    renderData = renderOutput;
  }

  const { traits, indexVarRegister } = traitsParser(renderData);
  for (const trait of traits) {
    if (trait.name === String(Key.Type) && trait.value === "image") {
      return renderImageSvg(traits);
    }
    // TODO: multiple images
    if (trait.name === String(Key.Image) && trait.value instanceof Promise) {
      return renderDob1Svg(trait.value);
    }
  }
  const renderOptions = renderTextParamsParser(traits, indexVarRegister);
  return renderTextSvg({ ...renderOptions, font: props?.font });
}
