import { ChannelMixin } from "./api/channel.js";
import { InfoMixin } from "./api/info.js";
import { InvoiceMixin } from "./api/invoice.js";
import { PaymentMixin } from "./api/payment.js";
import { PeerMixin } from "./api/peer.js";
import { FiberClient } from "./rpc.js";

export interface FiberSDKConfig {
  endpoint: string;
  timeout?: number;
}

class FiberBase {
  readonly rpc: FiberClient;

  constructor(config: FiberSDKConfig) {
    this.rpc = new FiberClient({
      endpoint: config.endpoint,
      timeout: config.timeout,
    });
  }
}

/**
 * High-level SDK for Fiber node RPC .
 *
 * @example
 * ```ts
 * const sdk = new FiberSDK({
 *   endpoint: "http://127.0.0.1:8227",
 *   timeout: 5000,
 * });
 * ```
 *
 * @example
 * ```ts
 * const channels = await sdk.listChannels();
 * const { invoiceAddress, invoice } = await sdk.newInvoice({
 *   amount: "0x5f5e100",
 *   currency: "Fibt",
 * });
 * const payment = await sdk.sendPayment({ invoice: invoiceAddress });
 * ```
 *
 * @link https://www.typescriptlang.org/docs/handbook/mixins.html
 */
export class FiberSDK extends ChannelMixin(
  PaymentMixin(InvoiceMixin(InfoMixin(PeerMixin(FiberBase)))),
) {
  constructor(config: FiberSDKConfig) {
    super(config);
  }
}

export default FiberSDK;
