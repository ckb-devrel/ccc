import { ccc } from "@ckb-ccc/connector-react";
import React, { ReactNode } from "react";
import { Address } from "../components/Address";
import { CellInfo } from "../components/Cell";
import { Transaction } from "../components/Transaction";

export async function enhanceDisplay(
  msg: unknown,
  client: ccc.Client,
): Promise<ReactNode> {
  if (msg instanceof Error) {
    const { message, cause, stack } = msg;
    return (
      <div>
        <div className="whitespace-pre-line">{message.toString()}</div>
        {cause?.toString ? (
          <div className="whitespace-pre-line">{cause.toString()}</div>
        ) : undefined}
        <div className="text-sm whitespace-pre-line text-gray-300/75">
          {stack?.toString()}
        </div>
      </div>
    );
  }

  if (
    typeof msg === "string" &&
    (msg.startsWith(`"http://`) || msg.startsWith(`"https://`))
  ) {
    const url = msg.slice(1, -1);
    return (
      <a
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
    return <Transaction tx={msg} client={client} />;
  }

  if (msg instanceof ccc.Address) {
    return <Address address={msg} />;
  }

  if (msg instanceof ccc.Script) {
    return <Address address={ccc.Address.fromScript(msg, client)} />;
  }

  if (
    typeof msg === "string" &&
    (msg.startsWith("ckb") || msg.startsWith("ckt"))
  ) {
    try {
      return (
        <Address
          address={await ccc.Address.fromString(msg, {
            ckb: new ccc.ClientPublicMainnet(),
            ckt: new ccc.ClientPublicTestnet(),
          })}
        />
      );
    } catch (_err) {}
  }

  if (msg instanceof ccc.Signer) {
    return <Address address={await msg.getRecommendedAddressObj()} />;
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
    return <CellInfo cell={cell} client={client} />;
  }

  if (msg instanceof ccc.Bytes) {
    return ccc.hexFrom(msg);
  }

  if (React.isValidElement(msg)) {
    return msg;
  }

  return (
    <>
      {JSON.stringify(msg, (_, value) => {
        if (typeof value === "bigint") {
          return value.toString();
        }
        return value;
      })}{" "}
    </>
  );
}
