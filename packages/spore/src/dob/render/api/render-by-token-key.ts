import type { RenderProps } from "../core/renderers/text-renderer";
import { dobDecode } from "../services/api/dob-decode";
import { renderByDobDecodeResponse } from "./render-by-dob-decode-response";

export async function renderByTokenKey(
  tokenKey: string,
  options?: Pick<RenderProps, "font"> & {
    outputType?: "svg";
  },
) {
  const dobDecodeResponse = await dobDecode(tokenKey);
  return renderByDobDecodeResponse(dobDecodeResponse.result, options);
}
