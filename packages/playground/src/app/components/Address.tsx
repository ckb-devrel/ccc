import { ccc } from "@ckb-ccc/connector-react";
import { useMemo, useState } from "react";
import { getScriptColor, useGetExplorerLink } from "../utils";

export function Address({
  address,
  isDefaultOpen,
}: {
  address: ccc.Address;
  isDefaultOpen?: boolean;
}) {
  const { explorerAddress } = useGetExplorerLink();

  const [isOpen, setIsOpen] = useState<boolean | undefined>();

  const scriptHash = useMemo(() => address.script.hash(), [address]);

  if (!(isOpen ?? isDefaultOpen ?? false)) {
    return (
      <div
        key={scriptHash}
        className="flex flex-col rounded-md p-2"
        style={{
          backgroundColor: getScriptColor(address.script),
        }}
      >
        <div className="break-all">{explorerAddress(address.toString())}</div>
        <button
          className="mt-2 text-sm text-gray-300 hover:underline"
          onClick={() => setIsOpen(true)}
        >
          Show More
        </button>
      </div>
    );
  }

  return (
    <div
      key={scriptHash}
      className="flex flex-col rounded-md p-2"
      style={{
        backgroundColor: getScriptColor(address.script),
      }}
    >
      <div className="-mb-1 text-sm text-gray-300">address</div>
      <div className="break-all">{explorerAddress(address.toString())}</div>
      <div className="-mb-1 text-sm text-gray-300">scriptHash</div>
      <div className="break-all">{scriptHash}</div>
      <div className="-mb-1 text-sm text-gray-300">codeHash</div>
      <div className="break-all">{address.script.codeHash}</div>
      <div className="-mb-1 text-sm text-gray-300">hashType</div>
      <div className="break-all">{address.script.hashType}</div>
      <div className="-mb-1 text-sm text-gray-300">args</div>
      <div className="break-all">{address.script.args}</div>
      <button
        className="mt-2 text-sm text-gray-300 hover:underline"
        onClick={() => setIsOpen(false)}
      >
        Hide Details
      </button>
    </div>
  );
}
