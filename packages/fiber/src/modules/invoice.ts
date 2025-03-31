import { FiberClient } from "../core/client";
import { CkbInvoice, CkbInvoiceStatus, Hash256 } from "../types";

export class InvoiceModule {
  constructor(private client: FiberClient) {}

  /**
   * 创建新发票
   */
  async newInvoice(params: {
    amount: bigint;
    description?: string;
    currency: "Fibb" | "Fibt" | "Fibd";
    payment_preimage: Hash256;
    expiry?: bigint;
    fallback_address?: string;
    final_expiry_delta?: bigint;
    udt_type_script?: any;
    hash_algorithm?: "CkbHash" | "Sha256";
  }): Promise<{
    invoice_address: string;
    invoice: CkbInvoice;
  }> {
    return this.client.call("invoice.new_invoice", params);
  }

  /**
   * 解析发票
   */
  async parseInvoice(invoice: string): Promise<CkbInvoice> {
    return this.client.call("invoice.parse_invoice", { invoice });
  }

  /**
   * 获取发票
   */
  async getInvoice(paymentHash: Hash256): Promise<CkbInvoiceStatus> {
    return this.client.call("invoice.get_invoice", {
      payment_hash: paymentHash,
    });
  }

  /**
   * 取消发票
   */
  async cancelInvoice(paymentHash: Hash256): Promise<CkbInvoiceStatus> {
    return this.client.call("invoice.cancel_invoice", {
      payment_hash: paymentHash,
    });
  }
}
