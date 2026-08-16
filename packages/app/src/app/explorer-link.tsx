import type { ccc } from "@ckb-ccc/connector-react";
import { ArrowUpRight } from "lucide-react";
import type { ReactNode } from "react";

type ExplorerResource = "address" | "transaction";

export function explorerLink(
  client: ccc.Client,
  resource: ExplorerResource,
  value: string,
  content: ReactNode = value,
) {
  const origin =
    client.addressPrefix === "ckb"
      ? "https://explorer.nervos.org"
      : "https://pudge.explorer.nervos.org";

  return (
    <a
      href={`${origin}/${resource}/${value}`}
      target="_blank"
      rel="noreferrer"
      title={value}
    >
      {content}
      <ArrowUpRight size={14} />
    </a>
  );
}
