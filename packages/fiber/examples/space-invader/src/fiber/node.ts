import type { Hex } from "@ckb-ccc/core";
import { FiberSDK } from "@ckb-ccc/fiber";

export class FiberNode {
  readonly sdk: FiberSDK;

  constructor(
    public readonly url: string,
    public readonly peerId: string,
    public readonly address: string,
  ) {
    this.sdk = new FiberSDK({ endpoint: url, timeout: 30_000 });
  }

  /** RPC-like API for compatibility: connectPeer, listChannels. */
  get rpc() {
    return {
      connectPeer: (params: { address: string; save?: boolean }) =>
        this.sdk.connectPeer(params),
      listChannels: (params?: { peerId?: string; includeClosed?: boolean }) =>
        this.sdk.listChannels(params),
    };
  }

  private generateRandomPaymentPreimage(): Hex {
    const bytes = crypto.getRandomValues(new Uint8Array(32));
    return (
      "0x" +
      Array.from(bytes)
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("")
    ) as Hex;
  }

  async createCKBInvoice(amount: Hex, description: string) {
    return this.sdk.newInvoice({
      amount,
      currency: "Fibt",
      description,
      expiry: "0xe10",
      paymentPreimage: this.generateRandomPaymentPreimage(),
    });
  }

  async sendPayment(invoice: string) {
    return this.sdk.sendPayment({ invoice });
  }
}
