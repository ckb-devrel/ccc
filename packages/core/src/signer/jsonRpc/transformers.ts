import { BytesLike, bytesFrom } from "../../bytes/index.js";
import { CellInput, Transaction, TransactionLike } from "../../ckb/index.js";
import {
  JsonRpcCellInput,
  JsonRpcCellOutput,
  JsonRpcTransaction,
  JsonRpcTransformers,
} from "../../client/jsonRpc/advanced.js";
import { Hex, hexFrom } from "../../hex/index.js";
import { SignerSignType, SignerType } from "../signer/index.js";

export type SignerJsonRpcInfo = {
  sessionId: string;
  type: SignerType;
  signType: SignerSignType;
  name?: string;
  icon?: string;
};

export type SignerJsonRpcInfoPayload = {
  session_id: string;
  type: SignerType;
  sign_type: SignerSignType;
  name?: string;
  icon?: string;
};

export type SignerJsonRpcMessageToSign =
  { type: "string"; value: string } | { type: "bytes"; value: Hex };

export type SignerJsonRpcCellInput = JsonRpcCellInput & {
  cell_output?: JsonRpcCellOutput;
  output_data?: Hex;
};

export type SignerJsonRpcTransaction = Omit<JsonRpcTransaction, "inputs"> & {
  inputs: SignerJsonRpcCellInput[];
};

const PROOF_INDEX = 0xffffffffn;
const PROOF_CAPACITY = 0xffffffffffffffffn;

/**
 * Whether the transaction has the out point of a lock proof: a single input, at index 0xffffffff, with
 * a 32-byte tx hash that is not all zero. No transaction has that many outputs, so no cell exists at
 * such an out point and nothing can be looked up for it.
 */
function hasPseudoOutPoint(tx: Transaction) {
  if (tx.inputs.length !== 1) {
    return false;
  }
  const { txHash, index } = tx.inputs[0].previousOutput;
  return (
    index === PROOF_INDEX &&
    /^0x[0-9a-f]{64}$/.test(txHash) &&
    !/^0x0+$/.test(txHash)
  );
}

/**
 * Whether the only input of the transaction is the placeholder input of a lock proof: the out point
 * above, and a cell with capacity u64::MAX, no type and empty data.
 */
function isPseudoInput(tx: Transaction) {
  const { cellOutput, outputData } = tx.inputs[0] ?? {};
  return (
    hasPseudoOutPoint(tx) &&
    cellOutput?.capacity === PROOF_CAPACITY &&
    cellOutput.type == null &&
    outputData === "0x"
  );
}

export class SignerJsonRpcTransformers {
  /** Like `JsonRpcTransformers.transactionFrom`, and carries the cell of a lock proof input. */
  static transactionFrom(txLike: TransactionLike): SignerJsonRpcTransaction {
    const tx = Transaction.from(txLike);
    const json = JsonRpcTransformers.transactionFrom(tx);
    if (!isPseudoInput(tx)) {
      return json;
    }
    const { cellOutput, outputData } = tx.inputs[0];
    return {
      ...json,
      inputs: [
        {
          ...json.inputs[0],
          cell_output: JsonRpcTransformers.cellOutputFrom(cellOutput!),
          output_data: outputData,
        },
      ],
    };
  }

  /**
   * Reads a carried cell only for a lock proof input, and only when `accept` is true. The out point is
   * checked before the carried cell is decoded, so extra fields on any other input are ignored and the
   * input is looked up as usual.
   */
  static transactionTo(
    json: SignerJsonRpcTransaction,
    accept = true,
  ): Transaction {
    const tx = JsonRpcTransformers.transactionTo(json);
    if (!accept || !hasPseudoOutPoint(tx)) {
      return tx;
    }
    const { cell_output, output_data } = json.inputs[0];
    if (cell_output == null || output_data == null) {
      return tx;
    }
    const kept = tx.inputs[0];
    tx.inputs[0] = CellInput.from({
      previousOutput: kept.previousOutput,
      since: kept.since,
      cellOutput: JsonRpcTransformers.cellOutputTo(cell_output),
      outputData: output_data,
    });
    if (!isPseudoInput(tx)) {
      tx.inputs[0] = kept;
    }
    return tx;
  }

  static infoFrom(info: SignerJsonRpcInfo): SignerJsonRpcInfoPayload {
    return {
      session_id: info.sessionId,
      type: info.type,
      sign_type: info.signType,
      name: info.name,
      icon: info.icon,
    };
  }

  static infoTo(info: SignerJsonRpcInfoPayload): SignerJsonRpcInfo {
    return {
      sessionId: info.session_id,
      type: info.type,
      signType: info.sign_type,
      name: info.name,
      icon: info.icon,
    };
  }

  static messageFrom(message: string | BytesLike): SignerJsonRpcMessageToSign {
    if (typeof message === "string") {
      return { type: "string", value: message };
    }

    return { type: "bytes", value: hexFrom(message) };
  }

  static messageTo(message: unknown): string | Uint8Array {
    if (!isRecord(message) || typeof message.value !== "string") {
      throw new Error("Invalid signer message");
    }

    if (message.type === "string") {
      return message.value;
    }
    if (message.type === "bytes") {
      return bytesFrom(message.value);
    }

    throw new Error("Invalid signer message type");
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
