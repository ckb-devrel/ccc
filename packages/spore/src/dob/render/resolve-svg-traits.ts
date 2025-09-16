import type { INode } from 'svgson'
import { parse } from 'svgson'
import type { BtcFsURI, IpfsURI } from './config'
import { config } from './config'
import { processFileServerResult } from './utils/mime'

async function handleNodeHref(node: INode) {
  if (node.name !== 'image') {
    if (node.children.length) {
      node.children = await Promise.all(
        node.children.map((n) => handleNodeHref(n)),
      )
    }
    return node
  }
  if ('href' in node.attributes) {
    const href = node.attributes.href
    let result;
    
    if (href.startsWith('btcfs://')) {
      result = await config.queryBtcFsFn(node.attributes.href as BtcFsURI)
    } else if (href.startsWith('ipfs://')) {
      result = await config.queryIpfsFn(node.attributes.href as IpfsURI)
    } else {
      result = await config.queryUrlFn(node.attributes.href as string)
    }
    
    node.attributes.href = processFileServerResult(result)
  }

  return node
}

export async function resolveSvgTraits(svgStr: string): Promise<INode> {
  try {
    const svgAST = await parse(svgStr)
    await handleNodeHref(svgAST)
    return svgAST
  } catch (error) {
    return {
      value: '',
      type: 'element',
      name: 'svg',
      children: [],
      attributes: {},
    }
  }
}
