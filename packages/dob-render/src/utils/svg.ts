import type { INode } from "svgson";
import { parse } from "svgson";
import { SvgParseError, SvgResolveError } from "../types/errors.js";
import {
  defaultQueryBtcFsFn,
  defaultQueryCkbFsFn,
  defaultQueryIpfsFn,
  defaultQueryUrlFn,
  type BtcFsURI,
  type CkbFsURI,
  type IpfsURI,
  type QueryBtcFsFn,
  type QueryCkbFsFn,
  type QueryIpfsFn,
  type QueryOptions,
  type QueryUrlFn,
} from "../types/query.js";
import { processFileServerResult } from "./mime.js";
import { base64Encode } from "./string.js";

export async function svgToBase64(svgCode: string) {
  return `data:image/svg+xml;base64,${base64Encode(svgCode)}`;
}

async function handleNodeHref(
  node: INode,
  queryBtcFsFn?: QueryBtcFsFn,
  queryIpfsFn?: QueryIpfsFn,
  queryCkbFsFn?: QueryCkbFsFn,
  queryUrlFn?: QueryUrlFn,
) {
  if (node.name !== "image") {
    if (node.children.length) {
      node.children = await Promise.all(
        node.children.map((n) =>
          handleNodeHref(
            n,
            queryBtcFsFn,
            queryIpfsFn,
            queryCkbFsFn,
            queryUrlFn,
          ),
        ),
      );
    }
    return node;
  }
  if ("href" in node.attributes) {
    const href = node.attributes.href;
    let result;

    try {
      if (href.startsWith("btcfs://") && queryBtcFsFn) {
        result = await queryBtcFsFn(node.attributes.href as BtcFsURI);
      } else if (href.startsWith("ipfs://") && queryIpfsFn) {
        result = await queryIpfsFn(node.attributes.href as IpfsURI);
      } else if (href.startsWith("ckbfs://") && queryCkbFsFn) {
        result = await queryCkbFsFn(node.attributes.href as CkbFsURI);
      } else if (queryUrlFn) {
        result = await queryUrlFn(node.attributes.href);
      } else {
        return node; // No query function available, skip processing
      }

      node.attributes.href = processFileServerResult(result);
    } catch (error: unknown) {
      if (error instanceof Error) {
        throw new SvgResolveError(
          `Failed to resolve href "${href}": ${error.message}`,
          undefined,
          href,
          error,
        );
      } else {
        throw new SvgResolveError(
          `Failed to resolve href "${href}": Unknown error`,
          undefined,
          href,
          new Error(String(error)),
        );
      }
    }
  }

  return node;
}

export async function resolveSvgTraits(
  svgStr: string,
  options?: QueryOptions,
): Promise<INode> {
  try {
    const svgAST = await parse(svgStr);
    await handleNodeHref(
      svgAST,
      options?.queryBtcFsFn || defaultQueryBtcFsFn,
      options?.queryIpfsFn || defaultQueryIpfsFn,
      options?.queryCkbFsFn || defaultQueryCkbFsFn,
      options?.queryUrlFn || defaultQueryUrlFn,
    );
    return svgAST;
  } catch (error: unknown) {
    if (error instanceof Error) {
      throw new SvgParseError(
        `Failed to parse or resolve SVG content: ${error.message}`,
        svgStr,
        error,
      );
    } else {
      throw new SvgParseError(
        "Failed to parse or resolve SVG content: Unknown error",
        svgStr,
        new Error(String(error)),
      );
    }
  }
}
