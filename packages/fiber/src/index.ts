import { FiberClient } from "./core/client";
import { ChannelModule } from "./modules/channel";
import { InfoModule } from "./modules/info";
import { InvoiceModule } from "./modules/invoice";
import { PaymentModule } from "./modules/payment";
import { PeerModule } from "./modules/peer";

export interface FiberSDKConfig {
  endpoint: string;
  timeout?: number;
}

export class FiberSDK {
  public channel: ChannelModule;
  public payment: PaymentModule;
  public invoice: InvoiceModule;
  public peer: PeerModule;
  public info: InfoModule;

  constructor(config: FiberSDKConfig) {
    const client = new FiberClient({
      baseURL: config.endpoint,
      timeout: config.timeout,
    });

    this.channel = new ChannelModule(client);
    this.payment = new PaymentModule(client);
    this.invoice = new InvoiceModule(client);
    this.peer = new PeerModule(client);
    this.info = new InfoModule(client);
  }
}
