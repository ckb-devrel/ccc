import { ccc } from "@ckb-ccc/connector-react";
import { Address } from "./Address";
import { Transaction } from "./Transaction";
import { formatTimestamp } from "../utils";
import { CellInfo } from "./Cell";

export function enhanceDisplay(
  log: (level: "error" | "info", title: string, msgs: unknown[]) => void,
  client: ccc.Client,
): (level: "error" | "info", msgs: unknown[]) => void {
  return (level: "error" | "info", msgs: unknown[]) => {
    Promise.all(
      msgs.map(async (msg, i) => {
        if (
          typeof msg === "string" &&
          (msg.startsWith(`"http://`) || msg.startsWith(`"https://`))
        ) {
          const url = msg.slice(1, -1);
          return (
            <a
              key={i}
              className="px-2 text-[#2D5FF5] underline underline-offset-2"
              href={url}
              target="_blank"
              rel="noopener noreferrer"
            >
              {url}
            </a>
          );
        }

        if (msg instanceof ccc.Transaction) {
          return <Transaction key={i} tx={msg} client={client} />;
        }

        if (msg instanceof ccc.Address) {
          return <Address key={i} address={msg} />;
        }

        if (msg instanceof ccc.Script) {
          return (
            <Address key={i} address={ccc.Address.fromScript(msg, client)} />
          );
        }

        if (
          typeof msg === "string" &&
          (msg.startsWith("ckb") || msg.startsWith("ckt"))
        ) {
          try {
            return (
              <Address
                key={i}
                address={await ccc.Address.fromString(msg, {
                  ckb: new ccc.ClientPublicMainnet(),
                  ckt: new ccc.ClientPublicTestnet(),
                })}
              />
            );
          } catch (err) {}
        }

        if (msg instanceof ccc.Signer) {
          return (
            <Address key={i} address={await msg.getRecommendedAddressObj()} />
          );
        }

        if (
          msg instanceof ccc.CellInput ||
          msg instanceof ccc.Cell ||
          msg instanceof ccc.CellOutput
        ) {
          const cell = ((): {
            outPoint?: ccc.OutPoint;
            cellOutput?: ccc.CellOutput;
            outputData?: ccc.Hex;
          } => {
            if (msg instanceof ccc.Cell) {
              return msg;
            }
            if (msg instanceof ccc.CellInput) {
              return {
                outPoint: msg.previousOutput,
                cellOutput: msg.cellOutput,
                outputData: msg.outputData,
              };
            }
            return {
              cellOutput: msg,
            };
          })();
          return <CellInfo key={i} cell={cell} client={client} />;
        }

        if (msg instanceof ccc.Bytes) {
          return ccc.hexFrom(msg);
        }

        return msg;
      }),
    ).then((msgs) => log(level, formatTimestamp(Date.now()), msgs));
  };
}
