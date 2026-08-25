import { ccc } from "@ckb-ccc/ccc";
import { ReactiveControllerHost } from "lit";

export class SignersController {
  public wallets: ccc.WalletWithSigners[] = [];
  private refreshId = 0;
  private refreshTimer?: ReturnType<typeof setTimeout>;

  constructor(
    private readonly host: ReactiveControllerHost & {
      client: ccc.Client;
      preferredNetworks?: ccc.NetworkPreference[];
      name?: string;
      icon?: string;
      refreshSigner: () => void;
      signersController: ccc.SignersController;
    },
  ) {
    host.addController(this);
  }

  refresh() {
    const refreshId = ++this.refreshId;
    return this.host.signersController.refresh(
      this.host.client,
      (wallets) => {
        if (refreshId !== this.refreshId) {
          return;
        }
        this.wallets = [...wallets];
        this.update();
      },
      this.host,
    );
  }

  update() {
    this.host.refreshSigner();
    this.host.requestUpdate();
  }

  hostConnected(): void {
    // Wait for plugins to be loaded
    this.refreshTimer = setTimeout(() => {
      this.refreshTimer = undefined;
      void this.refresh();
    }, 500);
  }

  hostDisconnected(): void {
    clearTimeout(this.refreshTimer);
    this.refreshTimer = undefined;
    this.refreshId += 1;
    this.host.signersController.disconnect();
  }
}
