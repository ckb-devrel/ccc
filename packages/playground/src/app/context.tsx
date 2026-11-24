"use client";

import { ccc } from "@ckb-ccc/connector-react";
import { FlaskConical, Link } from "lucide-react";
import React, {
  createContext,
  ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { ExampleWallet } from "./exampleWallet";
import { createOutputQueue, type Messages } from "./outputQueue";
import {
  createOutputRun,
  reportUnhandledRejection,
  type SendOutputMessage,
} from "./outputRun";
import { createOutputSessionGate } from "./outputSession";
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

type WalletContext = {
  signer: ccc.Signer | undefined;
  isExampleWallet: boolean;
  enableExampleWallet: () => void;
  openSigner: () => unknown;
  disconnect: () => void;
  openAction: ReactNode;
};

type OutputCommands = {
  clearMessage: () => void;
  beginOutputRun: () => ReturnType<typeof createOutputRun>;
  sendMessage: SendOutputMessage;
};

const APP_CONTEXT = createContext<WalletContext | undefined>(undefined);
const OUTPUT_COMMANDS = createContext<OutputCommands | undefined>(undefined);
const OUTPUT_MESSAGES = createContext<Messages | undefined>(undefined);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const {
    wallet,
    signerInfo: cccSigner,
    open,
    client,
    disconnect,
  } = ccc.useCcc();

  const [address, setAddress] = useState<string>("");

  const [exampleEnabled, setExampleEnabled] = useState(false);
  const exampleWallet = useMemo(() => new ExampleWallet(client), [client]);
  const isExampleWallet = exampleEnabled && !cccSigner;
  const signer =
    cccSigner?.signer ?? (isExampleWallet ? exampleWallet : undefined);

  useEffect(() => {
    // A real connection must never silently fall back to the example on disconnect.
    if (cccSigner) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setExampleEnabled(false);
    }
  }, [cccSigner]);

  useEffect(() => {
    let active = true;

    // eslint-disable-next-line react-hooks/set-state-in-effect
    setAddress("");
    if (signer) {
      void signer
        .getInternalAddress()
        .then((a) => {
          if (active) {
            setAddress(a);
          }
        })
        .catch(() => {
          if (active) {
            setAddress("");
          }
        });
    }

    return () => {
      active = false;
    };
  }, [signer]);

  const walletContext = useMemo(
    () => ({
      signer,
      isExampleWallet,
      enableExampleWallet: () => {
        if (!cccSigner) {
          setExampleEnabled(true);
        }
      },
      // Opening or dismissing the picker does not replace the selected wallet.
      openSigner: open,
      disconnect: () => {
        setExampleEnabled(false);
        if (cccSigner) {
          disconnect();
        }
      },
      openAction: cccSigner ? (
        <>
          {wallet && <WalletIcon wallet={wallet} className="mr-2" />}
          {address === "" ? "Loading..." : formatString(address, 5, 4)}
        </>
      ) : isExampleWallet ? (
        <>
          <FlaskConical className="mr-2" size="1em" />
          Example wallet
        </>
      ) : (
        <>
          <Link className="mr-2" size="1em" />
          Connect
        </>
      ),
    }),
    [address, cccSigner, disconnect, isExampleWallet, open, signer, wallet],
  );

  return (
    <APP_CONTEXT.Provider value={walletContext}>
      <OutputProvider
        client={client}
        signer={signer}
        isExampleWallet={isExampleWallet}
      >
        {children}
      </OutputProvider>
    </APP_CONTEXT.Provider>
  );
}

function OutputProvider({
  children,
  client,
  signer,
  isExampleWallet,
}: {
  children: ReactNode;
  client: ccc.Client;
  signer: ccc.Signer | undefined;
  isExampleWallet: boolean;
}) {
  // Match the runtime bindings while a connector refresh is in flight.
  const outputClient = signer?.client ?? client;
  const [messages, setMessages] = useState<Messages>([]);
  const [queue] = useState(() =>
    createOutputQueue((batch) =>
      setMessages((previous) => [...previous, ...batch]),
    ),
  );
  const [outputSessions] = useState(createOutputSessionGate);

  const sendMessage = useCallback<SendOutputMessage>(
    (level, title, msgs, origin) => {
      queue.append(outputClient, isExampleWallet, level, title, msgs, origin);
    },
    [queue, outputClient, isExampleWallet],
  );

  useEffect(() => {
    return () => {
      outputSessions.invalidate();
      queue.clear();
    };
  }, [outputSessions, queue]);

  useEffect(() => {
    // Late callbacks from a previous wallet/network must not append to the new context.
    outputSessions.invalidate();
  }, [client, signer, outputSessions]);

  const outputCommands = useMemo<OutputCommands>(
    () => ({
      sendMessage,
      beginOutputRun: () => createOutputRun(outputSessions, sendMessage),
      clearMessage: () => {
        // Clear history and queued entries, not the currently running script.
        queue.clear();
        setMessages([]);
      },
    }),
    [outputSessions, queue, sendMessage],
  );

  useEffect(() => {
    const handler = (event: PromiseRejectionEvent) => {
      reportUnhandledRejection(
        event.reason,
        formatTimestamp(Date.now()),
        sendMessage,
      );
    };

    window.addEventListener("unhandledrejection", handler);
    return () => window.removeEventListener("unhandledrejection", handler);
  }, [sendMessage]);

  return (
    <OUTPUT_COMMANDS.Provider value={outputCommands}>
      <OUTPUT_MESSAGES.Provider value={messages}>
        {children}
      </OUTPUT_MESSAGES.Provider>
    </OUTPUT_COMMANDS.Provider>
  );
}

function useRequiredContext<T>(
  context: React.Context<T | undefined>,
  hookName: string,
): T {
  const value = React.useContext(context);
  if (value === undefined) {
    throw Error(`${hookName} must be used within AppProvider.`);
  }
  return value;
}

export function useApp() {
  return useRequiredContext(APP_CONTEXT, "useApp");
}

export function useOutputCommands() {
  return useRequiredContext(OUTPUT_COMMANDS, "useOutputCommands");
}

export function useOutputMessages() {
  return useRequiredContext(OUTPUT_MESSAGES, "useOutputMessages");
}
