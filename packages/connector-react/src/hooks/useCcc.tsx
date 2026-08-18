import { ccc } from "@ckb-ccc/connector";
import React, {
  CSSProperties,
  HTMLAttributes,
  ReactNode,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Connector } from "../components/index.js";

const CCC_CONTEXT = createContext<
  | {
      isOpen: boolean;
      open: () => unknown;
      close: () => unknown;
      disconnect: () => unknown;
      /**
       * Sets the active client and transfers its ownership to the connector.
       * The connector may close the client when it is replaced or disconnected.
       */
      setClient: (client: ccc.Client) => unknown;
      client: ccc.Client;
      wallet?: ccc.Wallet;
      signerInfo?: ccc.SignerInfo;
    }
  | undefined
>(undefined);

class SignersControllerWithFilter extends ccc.SignersController {
  constructor(
    public filter?: (
      signerInfo: ccc.SignerInfo,
      wallet: ccc.Wallet,
    ) => Promise<boolean>,
  ) {
    super();
  }

  async addSigner(
    walletName: string,
    icon: string,
    signerInfo: ccc.SignerInfo,
    context: ccc.SignersControllerRefreshContext,
  ) {
    if (
      this.filter &&
      !(await this.filter(signerInfo, { name: walletName, icon }))
    ) {
      return;
    }

    return super.addSigner(walletName, icon, signerInfo, context);
  }
}

export function Provider({
  children,
  connectorProps,
  hideMark,
  name,
  icon,
  signerFilter,
  signersController,
  defaultClient,
  clientOptions,
  preferredNetworks,
}: {
  children: ReactNode;
  connectorProps?: HTMLAttributes<{}>;
  hideMark?: boolean;
  name?: string;
  icon?: string;
  signerFilter?: (
    signerInfo: ccc.SignerInfo,
    wallet: ccc.Wallet,
  ) => Promise<boolean>;
  signersController?: ccc.SignersController;
  /** Transferred to the connector, which may subsequently close it. */
  defaultClient?: ccc.Client;
  /** Selected clients are transferred to the connector and may be closed. */
  clientOptions?: { icon?: string; client: ccc.Client; name: string }[];
  preferredNetworks?: ccc.NetworkPreference[];
}) {
  const [ref, setRef] = useState<ccc.WebComponentConnector | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [_, setFlag] = useState(0);
  const defaultSignersController = useRef<
    SignersControllerWithFilter | undefined
  >(undefined);

  const [initialClient] = useState(
    () => defaultClient ?? new ccc.ClientPublicTestnet(),
  );
  const client = ref?.client ?? initialClient;
  const open = useCallback(() => {
    setIsOpen(true);
    ref?.requestUpdate();
  }, [setIsOpen, ref, ref?.requestUpdate]);
  const close = useCallback(() => {
    setIsOpen(false);
    ref?.requestUpdate();
  }, [setIsOpen, ref, ref?.requestUpdate]);
  const disconnect = useMemo(
    () => ref?.disconnect.bind(ref) ?? (() => {}),
    [ref, ref?.disconnect],
  );
  const setClient = useMemo(
    () => ref?.setClient.bind(ref) ?? (() => {}),
    [ref, ref?.setClient],
  );

  useEffect(() => {
    setClient(initialClient);
  }, [initialClient, setClient]);
  useEffect(() => {
    if (!defaultSignersController.current) {
      defaultSignersController.current = new SignersControllerWithFilter(
        signerFilter,
      );
    } else {
      defaultSignersController.current.filter = signerFilter;
    }
  }, [signerFilter]);

  return (
    <CCC_CONTEXT.Provider
      value={{
        isOpen,
        open,
        close,
        disconnect,
        setClient,

        client,
        wallet: ref?.wallet,
        signerInfo: ref?.signer,
      }}
    >
      <Connector
        hideMark={hideMark}
        name={name}
        icon={icon}
        signersController={
          signersController ?? defaultSignersController.current
        }
        ref={setRef}
        onWillUpdate={() => setFlag((f) => f + 1)}
        onClose={close}
        preferredNetworks={preferredNetworks}
        clientOptions={clientOptions}
        {...{
          ...connectorProps,
          style: {
            zIndex: 999,
            ...(isOpen ? {} : { display: "none" }),
            ...({
              "--background": "#fff",
              "--divider": "#eee",
              "--btn-primary": "#f8f8f8",
              "--btn-primary-hover": "#efeeee",
              "--btn-secondary": "#ddd",
              "--btn-secondary-hover": "#ccc",
              "--btn-color": "currentColor",
              "--btn-color-hover": "var(--btn-color)",
              "--icon-primary": "#1E1E1E",
              "--icon-secondary": "#666666",
              color: "#1e1e1e",
              "--tip-color": "#666",
              "--tip-color-hover": "var(--tip-color)",
            } as CSSProperties),
            ...connectorProps?.style,
          },
        }}
      />
      {children}
    </CCC_CONTEXT.Provider>
  );
}

export function useCcc() {
  const context = useContext(CCC_CONTEXT);
  if (!context) {
    throw Error(
      "The component which invokes the useCcc hook should be placed in a ccc.Provider.",
    );
  }
  return context;
}
