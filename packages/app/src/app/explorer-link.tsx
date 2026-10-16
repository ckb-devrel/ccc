import type { ccc } from "@ckb-ccc/connector-react";
import { ArrowUpRight } from "lucide-react";
import type { ReactNode } from "react";

type ExplorerResource = "address" | "transaction";

export function getExplorerBaseUrl(client: ccc.Client): string {
  return client.addressPrefix === "ckb"
    ? "https://explorer.ckbccc.com/mainnet"
    : "https://test-explorer.ckbccc.com/testnet";
}

export function explorerLink(
  client: ccc.Client,
  resource: ExplorerResource,
  value: string,
  content: ReactNode = value,
  className?: string,
) {
  const baseUrl = getExplorerBaseUrl(client);
  const path = resource === "transaction" ? "tx" : resource;

  return (
    <a
      href={`${baseUrl}/${path}/${value}`}
      target="_blank"
      rel="noreferrer"
      title={value}
      className={className}
    >
      {content}
      <ArrowUpRight size={14} />
    </a>
  );
}
