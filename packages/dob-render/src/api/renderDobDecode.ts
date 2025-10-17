import { Key } from "../config/constants.js";
import { renderTextParamsParser } from "../core/parsers/textParamsParser.js";
import { traitsParser } from "../core/parsers/traitsParser.js";
import { renderDob1Svg } from "../core/renderers/dob1Render.js";
import { renderImageSvg } from "../core/renderers/imageRender.js";
import { renderTextSvg } from "../core/renderers/textRender.js";
import type { RenderOutput } from "../types/external.js";
import type { RenderOptions } from "../types/query.js";
import {
  defaultQueryBtcFsFn,
  defaultQueryCkbFsFn,
  defaultQueryIpfsFn,
  defaultQueryUrlFn,
} from "../types/query.js";

export function renderByDobDecodeResponse(
  renderOutput: RenderOutput,
  props?: RenderOptions,
) {
  const { traits, indexVarRegister } = traitsParser(renderOutput);
  for (const trait of traits) {
    if (trait.name === String(Key.Type) && trait.value === "image") {
      return renderImageSvg(traits, {
        queryBtcFsFn: props?.queryBtcFsFn || defaultQueryBtcFsFn,
        queryIpfsFn: props?.queryIpfsFn || defaultQueryIpfsFn,
        queryCkbFsFn: props?.queryCkbFsFn || defaultQueryCkbFsFn,
        queryUrlFn: props?.queryUrlFn || defaultQueryUrlFn,
      });
    }
    // TODO: multiple images
    if (trait.name === String(Key.Image) && trait.value instanceof Promise) {
      return renderDob1Svg(trait.value);
    }
  }
  const renderOptions = renderTextParamsParser(traits, indexVarRegister);
  return renderTextSvg({ ...renderOptions, font: props?.font });
}
