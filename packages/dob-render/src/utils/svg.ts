import type { INode } from "svgson";
import { parse } from "svgson";
import type { BtcFsURI, CkbFsURI, IpfsURI } from "../config.js";
import { config } from "../config.js";
import { processFileServerResult } from "./mime.js";

export async function svgToBase64(svgCode: string) {
  if (typeof window !== "undefined") {
    return `data:image/svg+xml;base64,${window.btoa(svgCode)}`; // browser
  }
  return `data:image/svg+xml;base64,${Buffer.from(svgCode).toString("base64")}`; // nodejs
}

async function handleNodeHref(node: INode) {
  if (node.name !== "image") {
    if (node.children.length) {
      node.children = await Promise.all(
        node.children.map((n) => handleNodeHref(n)),
      );
    }
    return node;
  }
  if ("href" in node.attributes) {
    const href = node.attributes.href;
    let result;

    if (href.startsWith("btcfs://")) {
      result = await config.queryBtcFsFn(node.attributes.href as BtcFsURI);
    } else if (href.startsWith("ipfs://")) {
      result = await config.queryIpfsFn(node.attributes.href as IpfsURI);
    } else if (href.startsWith("ckbfs://")) {
      result = await config.queryCkbFsFn(node.attributes.href as CkbFsURI);
    } else {
      result = await config.queryUrlFn(node.attributes.href);
    }

    node.attributes.href = processFileServerResult(result);
  }

  return node;
}

export async function resolveSvgTraits(svgStr: string): Promise<INode> {
  try {
    const svgAST = await parse(svgStr);
    await handleNodeHref(svgAST);
    return svgAST;
  } catch (error: unknown) {
    console.error(error);
    return {
      value: "",
      type: "element",
      name: "svg",
      children: [],
      attributes: {},
    };
  }
}
