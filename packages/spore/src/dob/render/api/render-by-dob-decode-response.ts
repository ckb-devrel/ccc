import { Key } from "../config/constants";
import { renderTextParamsParser } from "../core/parsers/text-params-parser";
import { traitsParser } from "../core/parsers/traits-parser";
import { renderDob1Svg } from "../core/renderers/dob1-renderer";
import { renderImageSvg } from "../core/renderers/image-renderer";
import type { RenderProps } from "../core/renderers/text-renderer";
import { renderTextSvg } from "../core/renderers/text-renderer";
import type {
  DobDecodeResult,
  RenderPartialOutput as RenderOutput,
} from "../types";

export function renderByDobDecodeResponse(
  dob0Data: DobDecodeResult | string,
  props?: Pick<RenderProps, "font"> & {
    outputType?: "svg";
  },
) {
  if (typeof dob0Data === "string") {
    dob0Data = JSON.parse(dob0Data) as DobDecodeResult;
  }
  if (typeof dob0Data.render_output === "string") {
    dob0Data.render_output = JSON.parse(
      dob0Data.render_output,
    ) as RenderOutput[];
  }
  const { traits, indexVarRegister } = traitsParser(dob0Data.render_output);
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
