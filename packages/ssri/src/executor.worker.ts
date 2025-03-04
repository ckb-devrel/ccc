import { ccc } from "@ckb-ccc/core";
import { cccA } from "@ckb-ccc/core/advanced";
import wasmModule from "@ckb-ccc/ssri-executor-wasm";
import {
  BroadcastChannelMessagePacket,
  GetCellsArguments,
  SSRIExecutorFunctionCall,
  SSRIExecutorWorkerInitializeOptions,
} from "./types.js";

const channelName = "ssri";
const channel = new BroadcastChannel(channelName);

let initialized = false;
let processing = false;
channel.onmessage = async (evt) => {
  const messagePacket = evt.data as BroadcastChannelMessagePacket;
  if (!messagePacket.targetName) {
    console.log("Executor Worker received global message", messagePacket);
    return;
  }

  if (!initialized && messagePacket.targetName === "ssriWorkers") {
    if (messagePacket.messageLabel === "initialize") {
      const data = messagePacket.data as SSRIExecutorWorkerInitializeOptions;
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      wasmModule.initiate(data.logLevel, "ssri");
      initialized = true;
      return;
    } else {
      channel.postMessage({
        senderName: "ssriExecutorWorker",
        targetName: messagePacket.senderName,
        messageLabel: "notInitialized",
        data: {},
      });
      return;
    }
  }
  if (
    initialized &&
    messagePacket.targetName === "ssriExecutorWorker" &&
    messagePacket.senderName === "ssriRpcWorker" &&
    messagePacket.messageLabel === "getTransactionResult"
  ) {
    const data = messagePacket.data as {
      tx_hash: string;
      tx: ccc.ClientTransactionResponse;
    };
    const transactionWithStatusResponseObject = {
      cycles: ccc.numToHex(data.tx.cycles ?? 0),
      fee: null,
      min_replace_fee: null,
      time_added_to_pool: null,
      transaction: {
        ...cccA.JsonRpcTransformers.transactionFrom(data.tx.transaction),
        hash: data.tx_hash,
      },
      tx_status: {
        block_hash: data.tx.blockHash,
        block_number: ccc.numToHex(data.tx.blockNumber ?? 0),
        tx_index: ccc.numToHex(data.tx.txIndex ?? 0),
        status: data.tx.status,
        reason: data.tx.reason,
      },
    };
    wasmModule.put_get_transaction_cache(
      data.tx_hash,
      JSON.stringify(transactionWithStatusResponseObject),
    );
  }
  if (
    initialized &&
    messagePacket.targetName === "ssriExecutorWorker" &&
    messagePacket.messageLabel === "getCellsResult"
  ) {
    const data = messagePacket.data as {
      arguments: GetCellsArguments;
      cells: ccc.Cell[];
    };
    wasmModule.put_get_cells_cache(
      {
        ...data.arguments.searchKey,
        scriptType:
          data.arguments.searchKey.scriptType == "lock" ? "Lock" : "Type",
      },
      data.arguments.order,
      data.arguments.limit,
      data.arguments.afterCursor
        ? ccc.bytesFrom(data.arguments.afterCursor)
        : undefined,
      JSON.stringify({
        objects: data.cells.map((cell) => ({
          outPoint: cccA.JsonRpcTransformers.outPointFrom(cell.outPoint),
          output: cccA.JsonRpcTransformers.cellOutputFrom(cell.cellOutput),
          outputData: cell.outputData,
        })),
        lastCursor: data.arguments.afterCursor || "0x",
      }),
    );
  }
  if (initialized && messagePacket.messageLabel === "execute" && !processing) {
    processing = true;
    const data = messagePacket.data as SSRIExecutorFunctionCall;
    try {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-explicit-any
      const result = (wasmModule as any)[data.name](...data.args);
      channel.postMessage({
        senderName: "ssriExecutorWorker",
        targetName: messagePacket.senderName,
        messageLabel: "executionResult",
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        data: result,
      });
      processing = false;
    } catch (e) {
      channel.postMessage({
        senderName: "ssriExecutorWorker",
        targetName: messagePacket.senderName,
        messageLabel: "executionError",
        // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
        data: `${e}`,
      });
      processing = false;
    }
  }
};
export default {} as typeof Worker & { new (): Worker };
