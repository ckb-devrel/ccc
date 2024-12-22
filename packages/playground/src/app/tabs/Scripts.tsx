import { ccc } from "@ckb-ccc/connector-react";
import { useEffect, useMemo, useState } from "react";
import { getScriptColor, useGetExplorerLink } from "../utils";

export function Scripts({ tx }: { tx?: ccc.Transaction }) {
  const { client } = ccc.useCcc();
  const { explorerAddress } = useGetExplorerLink();

  const [scripts, setScripts] = useState<Map<string, ccc.Script>>(new Map());

  useEffect(() => {
    setScripts(new Map());
    [tx?.inputs.map((i) => i.cellOutput) ?? [], tx?.outputs ?? []]
      .flat()
      .map((o) => {
        if (!o) {
          return;
        }

        return [o.lock, o.type];
      })
      .flat()
      .map((script) => {
        if (!script) {
          return;
        }

        setScripts((scripts) => {
          const hash = script.hash();
          if (scripts.has(hash)) {
            return scripts;
          }

          return new Map([...Array.from(scripts.entries()), [hash, script]]);
        });
      });
  }, [tx]);

  const scriptsList = useMemo(
    () =>
      Array.from(scripts.entries(), ([key, script]) => (
        <div
          key={key}
          className="p-2 py-4 flex flex-col"
          style={{
            backgroundColor: getScriptColor(script),
          }}
        >
          <div className="text-sm text-gray-300 -mb-1">address</div>
          <div className="break-all">
            {explorerAddress(
              ccc.Address.from({
                prefix: client.addressPrefix,
                script,
              }).toString()
            )}
          </div>
          <div className="text-sm text-gray-300 -mb-1">scriptHash</div>
          <div className="break-all">{key}</div>
          <div className="text-sm text-gray-300 -mb-1">codeHash</div>
          <div className="break-all">{script.codeHash}</div>
          <div className="text-sm text-gray-300 -mb-1">hashType</div>
          <div className="break-all">{script.hashType}</div>
          <div className="text-sm text-gray-300 -mb-1">args</div>
          <div className="break-all">{script.args}</div>
        </div>
      )),
    [scripts, explorerAddress, client]
  );

  return (
    <div className="flex flex-col grow justify-start overflow-y-auto">
      {scriptsList}
    </div>
  );
}
