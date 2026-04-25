// Import RenderProps type for font configuration
import type { RenderProps } from "../core/renderers/textRender.js";

export type FileServerResult =
  | string
  | {
      content: string;
      content_type: string;
    };

export type BtcFsResult = FileServerResult;
export type IpfsResult = FileServerResult;
export type CkbFsResult = FileServerResult;

export type BtcFsURI = `btcfs://${string}`;
export type IpfsURI = `ipfs://${string}`;
export type CkbFsURI = `ckbfs://${string}`;

export type QueryBtcFsFn = (uri: BtcFsURI) => Promise<BtcFsResult>;
export type QueryIpfsFn = (uri: IpfsURI) => Promise<IpfsResult>;
export type QueryCkbFsFn = (uri: CkbFsURI) => Promise<CkbFsResult>;
export type QueryUrlFn = (uri: string) => Promise<FileServerResult>;

// Default query functions
export const defaultQueryBtcFsFn: QueryBtcFsFn = async (uri) => {
  console.log("dob-render-sdk requiring", uri);
  const response = await fetch(
    `https://dob-decoder.ckbccc.com/restful/dob_extract_image?uri=${uri}&encode=base64`,
  );
  const text = await response.text();
  return {
    content: text,
    content_type: "",
  };
};

export const defaultQueryUrlFn: QueryUrlFn = async (url: string) => {
  console.log("dob-render-sdk requiring", url);
  const response = await fetch(url);
  const blob = await response.blob();

  // Environment-agnostic blob to base64 conversion
  if (typeof window !== "undefined" && typeof FileReader !== "undefined") {
    // Browser environment - use FileReader
    return new Promise<FileServerResult>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = function () {
        const base64 = this.result as string;
        resolve(base64);
      };
      reader.onerror = (error) => {
        reject(new Error(`FileReader error: ${error.type}`));
      };
      reader.readAsDataURL(blob);
    });
  } else {
    // Node.js environment - use Buffer
    try {
      const arrayBuffer = await blob.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      const base64 = buffer.toString("base64");
      const mimeType = blob.type || "application/octet-stream";
      return `data:${mimeType};base64,${base64}`;
    } catch (error) {
      throw new Error(`Buffer conversion error: ${String(error)}`);
    }
  }
};

export const defaultQueryIpfsFn: QueryIpfsFn = async (uri: IpfsURI) => {
  console.log("dob-render-sdk requiring", uri);
  const key = uri.substring("ipfs://".length);
  const url = `https://ipfs.io/ipfs/${key}`;
  return defaultQueryUrlFn(url);
};

export const defaultQueryCkbFsFn: QueryCkbFsFn = async (_uri: CkbFsURI) => {
  throw new Error("CkbFs is not supported");
};

export interface QueryOptions {
  queryBtcFsFn?: QueryBtcFsFn;
  queryIpfsFn?: QueryIpfsFn;
  queryCkbFsFn?: QueryCkbFsFn;
  queryUrlFn?: QueryUrlFn;
}

export type RenderOptions = QueryOptions & {
  font?: RenderProps["font"];
  outputType?: "svg";
};
