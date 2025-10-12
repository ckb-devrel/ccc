import { dob } from "@ckb-ccc/spore";
import { config } from "../config.js";
import type { RenderProps } from "../core/renderers/textRender.js";
import { renderByDobDecodeResponse } from "./renderDobDecode.js";

export async function renderByTokenKey(
  tokenKey: string,
  options?: Pick<RenderProps, "font"> & {
    outputType?: "svg";
  },
) {
  const renderOutput = await dob.decodeDobBySporeId(
    tokenKey,
    config.dobDecodeServerURL,
  );

  return renderByDobDecodeResponse(renderOutput, options);
}
