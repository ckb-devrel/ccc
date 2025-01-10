import { ccc } from "@ckb-ccc/core";
import { Axios } from "axios";
import { getErrorByCode } from "../helper/error.js";
import { RenderOutput } from "../helper/object.js";

export function extractDobFromDecoderResult(result: string): RenderOutput {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
  const decoderResult = JSON.parse(result);
  if ("error" in decoderResult) {
    const serverError = getErrorByCode(decoderResult.error.code as number);
    throw new Error(`Decode DOB failed: ${serverError}`);
  }
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-argument
  const renderResult = JSON.parse(decoderResult.result);
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-argument
  const renderOutput = JSON.parse(renderResult.render_output);
  // eslint-disable-next-line @typescript-eslint/no-unsafe-return
  return renderOutput;
}

export async function decodeDobBySporeId(
  sporeId: ccc.HexLike,
  dobServerUrl: string,
): Promise<RenderOutput> {
  const axios = new Axios({
    baseURL: dobServerUrl,
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
  });
  const result = await axios.post(
    "/",
    JSON.stringify({
      id: 0,
      jsonrpc: "2.0",
      method: "dob_decode",
      params: [ccc.hexFrom(sporeId).replace(/^0x/, "")],
    }),
  );
  return extractDobFromDecoderResult(result.data as string);
}

export async function decodeDobBySporeCell(
  sporeOutput: ccc.CellOutputLike,
  dobServerUrl: string,
): Promise<RenderOutput> {
  const sporeId = sporeOutput.type?.args;
  if (sporeId === undefined) {
    throw new Error("Invalid spore cell: missing spore id");
  }
  return decodeDobBySporeId(ccc.hexFrom(sporeId), dobServerUrl);
}

export async function decodeDobBySporeOutpoint(
  client: ccc.Client,
  sporeOutpoint: ccc.OutPointLike,
  dobServerUrl: string,
): Promise<RenderOutput> {
  const liveCell = await client.getCell(sporeOutpoint);
  if (!liveCell) {
    throw new Error("Invalid spore outpoint: missing spore cell");
  }
  return decodeDobBySporeCell(liveCell.cellOutput, dobServerUrl);
}

export async function decodeDobByRawData(
  sporeCellData: ccc.HexLike,
  clusterCellData: ccc.HexLike,
  dobServerUrl: string,
): Promise<RenderOutput> {
  const axios = new Axios({
    baseURL: dobServerUrl,
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
  });
  const result = await axios.post(
    "/",
    JSON.stringify({
      id: 0,
      jsonrpc: "2.0",
      method: "dob_raw_decode",
      params: [ccc.hexFrom(sporeCellData), ccc.hexFrom(clusterCellData)],
    }),
  );
  return extractDobFromDecoderResult(result.data as string);
}
