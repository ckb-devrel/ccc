import { FiberClient } from "../client";
import { CkbInvoice, CkbInvoiceStatus } from "../types";

export class InvoiceModule {
  constructor(private client: FiberClient) {}

  /**
   * 创建新发票
   */
  async newInvoice(params: {
    amount: bigint;
    description?: string;
    expiry?: bigint;
    payment_secret?: string;
  }): Promise<CkbInvoice> {
    return this.client.call("new_invoice", [params]);
  }

  /**
   * 解析发票
   */
  async parseInvoice(invoice: string): Promise<CkbInvoice> {
    return this.client.call("parse_invoice", [invoice]);
  }

  /**
   * 获取发票
   */
  async getInvoice(payment_hash: string): Promise<{
    status: CkbInvoiceStatus;
    invoice_address: string;
    invoice: CkbInvoice;
  }> {
    return this.client.call("get_invoice", [payment_hash]);
  }

  /**
   * 取消发票
   */
  async cancelInvoice(payment_hash: string): Promise<void> {
    return this.client.call("cancel_invoice", [payment_hash]);
  }
}
