import { dob } from "@ckb-ccc/spore";
import type { RenderOptions } from "../types/query.js";
import { renderByDobDecodeResponse } from "./renderDobDecode.js";

export async function renderByTokenKey(
  tokenKey: string,
  options?: RenderOptions & { dobDecodeServerURL?: string },
) {
  const serverURL =
    options?.dobDecodeServerURL || "https://dob-decoder.ckbccc.com";
  const renderOutput = await dob.decodeDobBySporeId(tokenKey, serverURL);

  return renderByDobDecodeResponse(renderOutput, options);
}
