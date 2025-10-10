import { decodeDobBySporeId } from "../../api/decode.js";
import { config } from "../config.js";
import type { RenderProps } from "../core/renderers/text-renderer.js";
import { renderByDobDecodeResponse } from "./render-by-dob-decode-response.js";

export async function renderByTokenKey(
  tokenKey: string,
  options?: Pick<RenderProps, "font"> & {
    outputType?: "svg";
  },
) {
  const renderOutput = await decodeDobBySporeId(
    tokenKey,
    config.dobDecodeServerURL,
  );

  return renderByDobDecodeResponse(renderOutput, options);
}
