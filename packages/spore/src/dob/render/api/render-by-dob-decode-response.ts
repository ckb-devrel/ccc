import type { RenderOutput } from "../../helper/object.js";
import { Key } from "../config/constants.js";
import { renderTextParamsParser } from "../core/parsers/text-params-parser.js";
import { traitsParser } from "../core/parsers/traits-parser.js";
import { renderDob1Svg } from "../core/renderers/dob1-renderer.js";
import { renderImageSvg } from "../core/renderers/image-renderer.js";
import type { RenderProps } from "../core/renderers/text-renderer.js";
import { renderTextSvg } from "../core/renderers/text-renderer.js";

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
    if (trait.name === "prev.type" && trait.value === "image") {
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
