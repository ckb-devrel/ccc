import { ccc } from "@ckb-ccc/ccc";
import { ReactiveControllerHost } from "lit";

export class SignersController {
  public wallets: ccc.WalletWithSigners[] = [];
  private readonly defaultController = new ccc.SignersController();
  private refreshId = 0;
  private refreshTimer?: ReturnType<typeof setTimeout>;

  get controller() {
    return this.host.signersController ?? this.defaultController;
  }

  constructor(
    private readonly host: ReactiveControllerHost & {
      client: ccc.Client;
      signerFilter?: (
        signerInfo: ccc.SignerInfo,
        wallet: ccc.Wallet,
      ) => Promise<boolean>;
      preferredNetworks?: ccc.NetworkPreference[];
      name?: string;
      icon?: string;
      refreshSigner: () => void;
      signersController?: ccc.SignersController;
    },
  ) {
    host.addController(this);
  }

  refresh() {
    const refreshId = ++this.refreshId;
    return this.controller.refresh(
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
    void this.refresh();
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
    this.controller.disconnect();
  }
}
