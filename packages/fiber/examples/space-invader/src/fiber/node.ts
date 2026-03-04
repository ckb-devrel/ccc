import { Hex } from "@ckb-ccc/core";
import { FiberRPC } from "./rpc";

export class FiberNode {
  public readonly rpc: FiberRPC;

  constructor(
    public readonly url: string,
    public readonly peerId: string,
    public readonly address: string,
  ) {
    this.rpc = new FiberRPC(url);
  }

  private generateRandomPaymentImage() {
    // use crypto to generate a 32 byte random hash
    const paymentHash = crypto.getRandomValues(new Uint8Array(32));
    return (
      "0x" +
      Array.from(paymentHash)
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("")
    );
  }

  async createCKBInvoice(amount: Hex, description: string) {
    const paymentImage = this.generateRandomPaymentImage();
    return await this.rpc.newInvoice({
      amount,
      currency: "Fibt",
      description,
      expiry: "0xe10",
      payment_preimage: paymentImage,
    });
  }

  async sendPayment(invoice: string) {
    return await this.rpc.sendPayment({
      invoice,
    });
  }
}
