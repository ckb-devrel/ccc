import { Eip6963 } from "@ckb-ccc/eip6963";
import { JoyId } from "@ckb-ccc/joy-id";
import { Nip07 } from "@ckb-ccc/nip07";
import { Okx } from "@ckb-ccc/okx";
import { Rei } from "@ckb-ccc/rei";
import { ccc } from "@ckb-ccc/shell";
import { UniSat } from "@ckb-ccc/uni-sat";
import { UtxoGlobal } from "@ckb-ccc/utxo-global";
import { Xverse } from "@ckb-ccc/xverse";
import { ETH_SVG } from "./assets/eth.svg.js";
import { JOY_ID_SVG } from "./assets/joy-id.svg.js";
import { METAMASK_SVG } from "./assets/metamask.svg.js";
import { NOSTR_SVG } from "./assets/nostr.svg.js";
import { OKX_SVG } from "./assets/okx.svg.js";
import { REI_SVG } from "./assets/rei.svg.js";
import { UNI_SAT_SVG } from "./assets/uni-sat.svg.js";
import { UTXO_GLOBAL_SVG } from "./assets/utxo-global.svg.js";

/**
 * @public
 */
export type WalletWithSigners = ccc.Wallet & {
  signers: ccc.SignerInfo[];
};

/**
 * @public
 */
export interface SignersControllerRefreshContext {
  client: ccc.Client;
  appName: string;
  appIcon: string;
  preferredNetworks: ccc.NetworkPreference[];
  onUpdate: (wallets: WalletWithSigners[]) => void;
  wallets: WalletWithSigners[];
}

/**
 * @public
 */
export class SignersController {
  private resetListeners: (() => void)[] = [];

  constructor() {}

  getConfig(configs?: {
    preferredNetworks?: ccc.NetworkPreference[];
    name?: string;
    icon?: string;
  }) {
    const appName =
      configs?.name ??
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
      (document.querySelector("head title") as HTMLTitleElement | null)?.text ??
      "Unknown";
    const appIcon =
      configs?.icon ??
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
      (document.querySelector('link[rel="icon"]') as HTMLLinkElement | null)
        ?.href ??
      "https://fav.farm/%E2%9D%93";

    const preferredNetworks = [
      ...(configs?.preferredNetworks ?? []),
      {
        addressPrefix: "ckb",
        signerType: ccc.SignerType.BTC,
        network: "btc",
      },
      {
        addressPrefix: "ckt",
        signerType: ccc.SignerType.BTC,
        network: "btcTestnet",
      },
      {
        addressPrefix: "ckb",
        signerType: ccc.SignerType.Doge,
        network: "doge",
      },
      {
        addressPrefix: "ckt",
        signerType: ccc.SignerType.Doge,
        network: "dogeTestnet",
      },
    ];

    return {
      appName,
      appIcon,
      preferredNetworks,
    };
  }

  disconnect() {
    this.resetListeners.forEach((listener) => listener());
    this.resetListeners = [];
  }

  async refresh(
    client: ccc.Client,
    onUpdate: (wallets: WalletWithSigners[]) => void,
    configs?: {
      preferredNetworks?: ccc.NetworkPreference[];
      name?: string;
      icon?: string;
    },
  ) {
    this.disconnect();

    const { appName, appIcon, preferredNetworks } = this.getConfig(configs);

    const context: SignersControllerRefreshContext = {
      client,
      appName,
      appIcon,
      preferredNetworks,
      onUpdate,
      wallets: [],
    };

    await this.addRealSigners(context);
    await this.addDummySigners(context);
  }

  async addRealSigners(context: SignersControllerRefreshContext) {
    const { appName, appIcon, client, preferredNetworks } = context;
    await this.addSigners(
      "UTXO Global Wallet",
      UTXO_GLOBAL_SVG,
      UtxoGlobal.getUtxoGlobalSigners(client, preferredNetworks),
      context,
    );

    await this.addSigners(
      "Rei Wallet",
      REI_SVG,
      Rei.getReiSigners(client),
      context,
    );

    await this.addSigners(
      "JoyID Passkey",
      JOY_ID_SVG,
      JoyId.getJoyIdSigners(client, appName, appIcon, preferredNetworks),
      context,
    );

    await this.addSigners(
      "UniSat",
      UNI_SAT_SVG,
      UniSat.getUniSatSigners(client, preferredNetworks),
      context,
    );

    await this.addSigners(
      "OKX Wallet",
      OKX_SVG,
      Okx.getOKXSigners(client, preferredNetworks),
      context,
    );

    await Promise.all(
      Xverse.getXverseSigners(client, preferredNetworks).map(
        ({ wallet, signerInfo }) =>
          this.addSigner(wallet.name, wallet.icon, signerInfo, context),
      ),
    );

    const nostrSigner = Nip07.getNip07Signer(client);
    if (nostrSigner) {
      await this.addSigner(
        "Nostr",
        NOSTR_SVG,
        {
          name: "Nostr",
          signer: nostrSigner,
        },
        context,
      );
    }

    this.resetListeners.push(
      new Eip6963.SignerFactory(client).subscribeSigners((signer, detail) =>
        this.addSigner(
          detail?.info.name ?? "EVM",
          detail?.info.icon ?? ETH_SVG,
          {
            name: "EVM",
            signer,
          },
          context,
        ),
      ),
    );
  }

  async addDummySigners(context: SignersControllerRefreshContext) {
    await this.addLinkSigners(
      "MetaMask",
      METAMASK_SVG,
      [ccc.SignerType.EVM],
      `https://metamask.app.link/dapp/${window.location.href}`,
      context,
    );
    await this.addLinkSigners(
      "OKX Wallet",
      OKX_SVG,
      [ccc.SignerType.EVM, ccc.SignerType.BTC],
      "https://www.okx.com/download?deeplink=" +
        encodeURIComponent(
          "okx://wallet/dapp/url?dappUrl=" +
            encodeURIComponent(window.location.href),
        ),
      context,
    );
    await this.addLinkSigners(
      "UniSat",
      UNI_SAT_SVG,
      [ccc.SignerType.BTC],
      "https://unisat.io/download",
      context,
    );
    await this.addLinkSigners(
      "UTXO Global Wallet",
      UTXO_GLOBAL_SVG,
      [ccc.SignerType.CKB, ccc.SignerType.BTC],
      "https://chromewebstore.google.com/detail/lnamkkidoonpeknminiadpgjiofpdmle",
      context,
    );
  }

  async addLinkSigners(
    walletName: string,
    icon: string,
    signerTypes: ccc.SignerType[],
    link: string,
    context: SignersControllerRefreshContext,
  ) {
    return this.addSigners(
      walletName,
      icon,
      signerTypes.map((type) => ({
        name: type,
        signer: new ccc.SignerOpenLink(context.client, type, link),
      })),
      context,
    );
  }

  async addSigners(
    walletName: string,
    icon: string,
    signers: ccc.SignerInfo[],
    context: SignersControllerRefreshContext,
  ) {
    return Promise.all(
      signers.map((signerInfo) =>
        this.addSigner(walletName, icon, signerInfo, context),
      ),
    );
  }

  protected async addSigner(
    walletName: string,
    icon: string,
    signerInfo: ccc.SignerInfo,
    { wallets, onUpdate }: SignersControllerRefreshContext,
  ): Promise<void> {
    const wallet = wallets.find((w) => w.name === walletName);

    if (!wallet) {
      wallets.push({
        name: walletName,
        icon,
        signers: [signerInfo],
      });
    } else {
      const signers = [...wallet.signers, signerInfo].filter(
        ({ signer }) => !(signer instanceof ccc.SignerDummy),
      );
      wallet.signers = signers.length !== 0 ? signers : [signerInfo];
    }

    onUpdate(wallets);
  }
}
