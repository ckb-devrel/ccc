import { FiberClient } from "./client";
import { CchModule } from "./modules/cch";
import { ChannelModule } from "./modules/channel";
import { DevModule } from "./modules/dev";
import { GraphModule } from "./modules/graph";
import { InfoModule } from "./modules/info";
import { InvoiceModule } from "./modules/invoice";
import { PaymentModule } from "./modules/payment";
import { PeerModule } from "./modules/peer";

export { FiberClient } from "./client";
export { CchModule } from "./modules/cch";
export { ChannelModule } from "./modules/channel";
export { DevModule } from "./modules/dev";
export { GraphModule } from "./modules/graph";
export { InfoModule } from "./modules/info";
export { InvoiceModule } from "./modules/invoice";
export { PaymentModule } from "./modules/payment";
export { PeerModule } from "./modules/peer";
export * from "./types";

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
  public graph: GraphModule;
  public dev: DevModule;
  public cch: CchModule;

  constructor(config: FiberSDKConfig) {
    const client = new FiberClient({
      endpoint: config.endpoint,
      timeout: config.timeout,
    });

    this.channel = new ChannelModule(client);
    this.payment = new PaymentModule(client);
    this.invoice = new InvoiceModule(client);
    this.peer = new PeerModule(client);
    this.info = new InfoModule(client);
    this.graph = new GraphModule(client);
    this.dev = new DevModule(client);
    this.cch = new CchModule(client);
  }
}
