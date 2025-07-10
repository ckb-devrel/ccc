"use client";

import { ccc } from "@ckb-ccc/connector-react";
import { Link } from "lucide-react";
import React, {
  createContext,
  ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { formatString, formatTimestamp } from "./utils";

function WalletIcon({
  wallet,
  className,
}: {
  wallet: ccc.Wallet;
  className?: string;
}) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={wallet.icon}
      alt={wallet.name}
      className={`rounded-full ${className}`}
      style={{ width: "1rem", height: "1rem" }}
    />
  );
}

export const APP_CONTEXT = createContext<
  | {
      enabledAnimate: boolean;
      backgroundLifted: boolean;
      setAnimate: (v: boolean) => void;
      setBackgroundLifted: (v: boolean) => void;

      signer: ccc.Signer;
      openSigner: () => void;
      disconnect: () => void;
      openAction: ReactNode;

      messages: ["error" | "info", string, unknown[], ReactNode | undefined][];
      clearMessage: () => void;
      sendMessage: (
        level: "error" | "info",
        title: string,
        msgs: unknown[],
      ) => void;
      createSender: (title: string) => {
        log: (...msgs: unknown[]) => void;
        error: (...msgs: unknown[]) => void;
      };
    }
  | undefined
>(undefined);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const {
    wallet,
    signerInfo: cccSigner,
    open,
    client,
    disconnect,
  } = ccc.useCcc();

  const privateKeySigner = useMemo(
    () =>
      new ccc.SignerCkbPublicKey(
        client,
        "0x026f3255791f578cc5e38783b6f2d87d4709697b797def6bf7b3b9af4120e2bfd9",
      ),
    [client],
  );
  const [address, setAddress] = useState<string>("");

  const [enabledAnimate, setAnimate] = useState(true);
  const [backgroundLifted, setBackgroundLifted] = useState(false);
  const signer = cccSigner?.signer ?? privateKeySigner;

  useEffect(() => {
    signer?.getInternalAddress().then((a) => setAddress(a));
  }, [signer]);

  const [{ messages }, setMessages] = useState<{
    messages: ["error" | "info", string, unknown[], ReactNode | undefined][];
    cachedMessages: number;
  }>({ messages: [], cachedMessages: 0 });

  const sendMessage = useCallback(
    (level: "error" | "info", title: string, msgs: unknown[]) =>
      messages.push([level, title, msgs, undefined]),
    [messages],
  );

  useEffect(() => {
    const interval = setInterval(() => {
      setMessages((messages) => {
        if (messages.messages.length === messages.cachedMessages) {
          return messages;
        }

        return {
          messages: [...messages.messages],
          cachedMessages: messages.messages.length,
        };
      });
    }, 100);

    return () => clearInterval(interval);
  }, [setMessages]);

  useEffect(() => {
    const handler = (event: PromiseRejectionEvent) => {
      const { name } = event.reason;
      sendMessage(
        "error",
        `${formatTimestamp(Date.now())} ${name?.toString() ?? "Unknown Error"}`,
        [event.reason],
      );
    };

    window.addEventListener("unhandledrejection", handler);
    return () => window.removeEventListener("unhandledrejection", handler);
  }, [sendMessage]);

  return (
    <APP_CONTEXT.Provider
      value={{
        enabledAnimate,
        backgroundLifted,
        setAnimate,
        setBackgroundLifted,

        signer,
        openSigner: () => {
          open();
        },
        disconnect: () => {
          disconnect();
        },
        openAction: cccSigner ? (
          <>
            {wallet && <WalletIcon wallet={wallet} className="mr-2" />}
            {formatString(address, 5, 4)}
          </>
        ) : (
          <>
            <Link className="mr-2" size="1em" />
            Connect
          </>
        ),

        messages,
        clearMessage: () => setMessages({ messages: [], cachedMessages: 0 }),
        sendMessage,
        createSender: (title) => ({
          log: (...msgs) => sendMessage("info", title, msgs),
          error: (...msgs) => sendMessage("error", title, msgs),
        }),
      }}
    >
      {children}
    </APP_CONTEXT.Provider>
  );
}

export function useApp() {
  const context = React.useContext(APP_CONTEXT);
  if (!context) {
    throw Error(
      "The component which invokes the useApp hook should be placed in a AppProvider.",
    );
  }
  return context;
}
