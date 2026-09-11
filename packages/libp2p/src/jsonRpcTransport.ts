import { ccc } from "@ckb-ccc/core";
import type { Libp2p, PeerId, Stream } from "@libp2p/interface";
import { lpStream } from "@libp2p/utils";

const DEFAULT_MAX_MESSAGE_LENGTH = 1024 * 1024;
const DEFAULT_TIMEOUT = 120_000;

export type JsonRpcTransportLibp2pConfig = {
  protocol: string;
  maxMessageLength?: number;
  timeout?: number;
  signal?: AbortSignal;
  onResponse?: (response: ccc.JsonRpcResponse) => void;
};

export class JsonRpcTransportLibp2p implements ccc.JsonRpcTransport {
  private readonly maxMessageLength: number;
  private readonly timeout: number;

  constructor(
    private readonly node: Libp2p,
    readonly peerId: PeerId,
    private readonly config: JsonRpcTransportLibp2pConfig,
  ) {
    const maxMessageLength =
      config.maxMessageLength ?? DEFAULT_MAX_MESSAGE_LENGTH;
    if (!Number.isSafeInteger(maxMessageLength) || maxMessageLength <= 0) {
      throw new Error(
        "Maximum JSON-RPC message length must be a positive integer",
      );
    }

    this.maxMessageLength = maxMessageLength;

    const timeout = config.timeout ?? DEFAULT_TIMEOUT;
    if (!Number.isSafeInteger(timeout) || timeout <= 0) {
      throw new Error("JSON-RPC request timeout must be a positive integer");
    }

    this.timeout = timeout;
  }

  async request(payload: ccc.JsonRpcPayload): Promise<ccc.JsonRpcResponse> {
    const timeoutSignal = AbortSignal.timeout(this.timeout);
    const signal = this.config.signal
      ? ccc.abortSignalAny([this.config.signal, timeoutSignal])
      : timeoutSignal;

    let stream: Stream | undefined;
    let response: ccc.JsonRpcResponse;
    try {
      // dialProtocol handles the signal, so no separate entry check is needed.
      stream = await this.node.dialProtocol(this.peerId, this.config.protocol, {
        runOnLimitedConnection: true,
        signal,
      });

      const rpcStream = lpStream(stream, {
        maxDataLength: this.maxMessageLength,
      });

      await rpcStream.write(ccc.bytesFrom(JSON.stringify(payload), "utf8"), {
        signal,
      });
      await stream.close({ signal });

      response = JSON.parse(
        ccc.bytesTo((await rpcStream.read({ signal })).subarray(), "utf8"),
      ) as ccc.JsonRpcResponse;
      await stream.closeRead({ signal });
      signal.throwIfAborted();
    } catch (cause) {
      const error = asJsonRpcError(cause);
      stream?.abort(error);
      throw error;
    }

    this.config.onResponse?.(response);
    return response;
  }
}

function asJsonRpcError(cause: unknown) {
  return cause instanceof Error ? cause : new Error("JSON-RPC request failed");
}
