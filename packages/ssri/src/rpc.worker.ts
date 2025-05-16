import { ccc } from "@ckb-ccc/core";
import {
  BroadcastChannelMessagePacket,
  GetCellsArguments,
  SSRIExecutorWorkerInitializeOptions,
} from "./types.js";

const channelName = "ssri";
const channel = new BroadcastChannel(channelName);

let initialized = false;
let processing = false;
let client: ccc.Client | undefined = new ccc.ClientPublicTestnet();
channel.onmessage = async (evt) => {
  const messagePacket = evt.data as BroadcastChannelMessagePacket;
  if (!messagePacket.targetName) {
    console.log(
      "RPC Worker received global message from",
      messagePacket.senderName,
    );
    return;
  }
  if (!initialized && messagePacket.targetName === "ssriWorkers") {
    if (messagePacket.messageLabel === "initialize") {
      const data = messagePacket.data as SSRIExecutorWorkerInitializeOptions;
      switch (data.network) {
        case "testnet":
          client = new ccc.ClientPublicTestnet({ url: data.rpcUrl });
          break;
        case "mainnet":
          client = new ccc.ClientPublicMainnet({ url: data.rpcUrl });
          break;
      }
      initialized = true;
    } else {
      channel.postMessage({
        senderName: "ssriRpcWorker",
        targetName: messagePacket.senderName,
        messageLabel: "notInitialized",
        data: {},
      });
      return;
    }
  }
  if (messagePacket.targetName === "ssriRpcWorker" && !processing) {
    processing = true;
    switch (messagePacket.messageLabel) {
      case "getTransaction":
        try {
          const result = await client?.getTransaction(
            messagePacket.data as ccc.HexLike,
          );
          channel.postMessage({
            senderName: "ssriRpcWorker",
            targetName: "ssriExecutorWorker",
            messageLabel: "getTransactionResult",
            data: {
              tx_hash: messagePacket.data,
              tx: result,
            },
          });
        } catch (error) {
          channel.postMessage({
            senderName: "ssriRpcWorker",
            targetName: "ssriExecutorWorker",
            messageLabel: "getTransactionError",
            data: error,
          });
        }
        break;
      case "getCells":
        try {
          const rawGetCellsArguments = messagePacket.data as Map<
            string,
            unknown
          >;
          const searchKeyMap = rawGetCellsArguments.get("searchKey") as
            | Map<string, unknown>
            | undefined;
          const scriptMap = searchKeyMap?.get("script") as
            | Map<string, unknown>
            | undefined;
          const filterMap = searchKeyMap?.get("filter") as
            | Map<string, unknown>
            | undefined;

          const searchKey = ccc.ClientIndexerSearchKey.from({
            script: {
              args: scriptMap?.get("args") as ccc.HexLike,
              codeHash: scriptMap?.get("code_hash") as ccc.HexLike,
              hashType: scriptMap?.get("hash_type") as ccc.HashTypeLike,
            },
            scriptType: (
              searchKeyMap?.get("scriptType") as string
            ).toLowerCase() as "lock" | "type",
            scriptSearchMode: searchKeyMap?.get("scriptSearchMode") as
              | "prefix"
              | "exact"
              | "partial",
            filter: !filterMap
              ? undefined
              : {
                  outputData: filterMap?.get("outputData") as
                    | string
                    | undefined,
                  outputDataSearchMode: filterMap?.get(
                    "outputDataSearchMode",
                  ) as "prefix" | "exact" | "partial",
                },
          });
          const getCellsArguments: GetCellsArguments = {
            searchKey: {
              script: {
                args: searchKey.script.args,
                code_hash: searchKey.script.codeHash,
                hash_type: searchKey.script.hashType,
              },
              scriptType: searchKey.scriptType,
              scriptSearchMode: searchKey.scriptSearchMode,
              filter: !searchKey.filter
                ? undefined
                : {
                    outputData: searchKey.filter?.outputData as ccc.HexLike,
                    outputDataSearchMode: searchKey.filter
                      ?.outputDataSearchMode as "prefix" | "exact" | "partial",
                  },
            },
            order: rawGetCellsArguments.get("order") as "asc" | "desc",
            limit: Number(
              ccc.numFromBytes(
                rawGetCellsArguments.get("limit") as ccc.HexLike,
              ),
            ),
            afterCursor:
              (rawGetCellsArguments.get("afterCursor") as string) === "0x"
                ? undefined
                : (rawGetCellsArguments.get("afterCursor") as string),
          };
          const result = await client?.findCellsPaged(
            searchKey,
            getCellsArguments.order,
            getCellsArguments.limit,
            getCellsArguments.afterCursor == "0x"
              ? undefined
              : getCellsArguments.afterCursor,
          );
          channel.postMessage({
            senderName: "ssriRpcWorker",
            targetName: "ssriExecutorWorker",
            messageLabel: "getCellsResult",
            data: {
              arguments: getCellsArguments,
              cells: result?.cells,
            },
          });
        } catch (error) {
          channel.postMessage({
            senderName: "ssriRpcWorker",
            targetName: "ssriExecutorWorker",
            messageLabel: "getCellError",
            data: error,
          });
        }
        break;
      default:
        break;
    }
    processing = false;
  }
};
export default {} as typeof Worker & { new (): Worker };
