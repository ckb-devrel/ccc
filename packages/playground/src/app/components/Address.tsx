import { ccc } from "@ckb-ccc/connector-react";
import { useEffect, useRef } from "react";
import { getExplorerLink, getScriptColor } from "../utils";
import { animateScriptDisclosure } from "./scriptDisclosure";

export function Address({
  address,
  isDefaultOpen = false,
}: {
  address: ccc.Address;
  isDefaultOpen?: boolean;
}) {
  const detailsRef = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    if (!detailsRef.current) {
      return;
    }
    return animateScriptDisclosure(
      detailsRef.current,
      window.matchMedia("(prefers-reduced-motion: reduce)"),
    );
  }, []);
  const { explorerAddress } = getExplorerLink(address.prefix);
  return (
    <div
      className="address-card"
      style={{ borderLeftColor: getScriptColor(address.script) }}
    >
      <div className="address-value">{explorerAddress(address.toString())}</div>
      <details
        ref={detailsRef}
        className="cell-details"
        open={isDefaultOpen || undefined}
      >
        <summary>Script details</summary>
        <dl className="detail-grid">
          <dt>Script hash</dt>
          <dd>{address.script.hash()}</dd>
          <dt>Code hash</dt>
          <dd>{address.script.codeHash}</dd>
          <dt>Hash type</dt>
          <dd>{address.script.hashType}</dd>
          <dt>Args</dt>
          <dd>{address.script.args}</dd>
        </dl>
      </details>
    </div>
  );
}
