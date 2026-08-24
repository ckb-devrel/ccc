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

type ClientInput = ccc.Client | ccc.Owner<ccc.Client>;

function isOwner(resource: ClientInput): resource is ccc.Owner<ccc.Client> {
  return "dispose" in resource && typeof resource.dispose === "function";
}

interface SetClient {
  (owner: ccc.Owner<ccc.Client>): void;
  /** @deprecated Pass an Owner<Client> so the Provider can manage its lifecycle. */
  (client: ccc.Client): void;
  (resource: ccc.Client | ccc.Owner<ccc.Client>): void;
}

const CCC_CONTEXT = createContext<
  | {
      isOpen: boolean;
      open: () => unknown;
      close: () => unknown;
      disconnect: () => unknown;
      setClient: SetClient;
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
  defaultClient?: ccc.Client;
  clientOptions?: { icon?: string; client: ccc.Client; name: string }[];
  preferredNetworks?: ccc.NetworkPreference[];
}) {
  const [ref, setRef] = useState<ccc.WebComponentConnector | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [_, setFlag] = useState(0);
  const defaultSignersController = useRef<
    SignersControllerWithFilter | undefined
  >(undefined);
  const replacementOwner = useRef<ccc.Owner<ccc.Client> | undefined>(undefined);
  const providedClient = defaultClient ?? clientOptions?.[0]?.client;
  const [fallbackClient, setFallbackClient] = useState<ccc.Client>();

  useEffect(() => {
    if (providedClient) return;

    const owner = ccc.ClientPublicTestnet.open();
    setFallbackClient(owner.value);
    return () => void owner.dispose().catch(() => {});
  }, [providedClient]);

  const initialClient = providedClient ?? fallbackClient;
  const client = ref?.client ?? initialClient;
  const setClient = useCallback(
    (resource: ClientInput) => {
      const owner = isOwner(resource)
        ? resource.map((value) => value)
        : new ccc.OwnerUnique(resource, () => {});
      const previous = replacementOwner.current;
      replacementOwner.current = owner;
      if (previous) void previous.dispose().catch(() => {});
      ref?.setClient(owner.value);
    },
    [ref],
  );

  useEffect(
    () => () => {
      void replacementOwner.current?.dispose().catch(() => {});
      replacementOwner.current = undefined;
    },
    [],
  );

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
  useEffect(() => {
    if (!defaultSignersController.current) {
      defaultSignersController.current = new SignersControllerWithFilter(
        signerFilter,
      );
    } else {
      defaultSignersController.current.filter = signerFilter;
    }
  }, [signerFilter]);

  if (!client || !initialClient) return null;

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
        client={initialClient}
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
