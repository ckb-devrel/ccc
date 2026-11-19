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
import { captureOutputEntry } from "./output";
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

export type Messages = ReturnType<typeof captureOutputEntry>[];

export const APP_CONTEXT = createContext<
  | {
      enabledAnimate: boolean;
      backgroundLifted: boolean;
      setAnimate: (v: boolean) => void;
      setBackgroundLifted: (v: boolean) => void;

      signer: ccc.Signer | undefined;
      isExampleWallet: boolean;
      enableExampleWallet: () => void;
      openSigner: () => unknown;
      disconnect: () => void;
      openAction: ReactNode;

      messages: Messages;
      clearMessage: () => void;
      beginOutputRun: () => {
        log: (level: "error" | "info", title: string, msgs: unknown[]) => void;
        isCurrent: () => boolean;
        terminalError: (error: unknown) => void;
      };
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

  const [address, setAddress] = useState<string>("");

  const [enabledAnimate, setAnimate] = useState(true);
  const [backgroundLifted, setBackgroundLifted] = useState(false);
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

  // Match the runtime bindings while a connector refresh is in flight.
  const outputClient = signer?.client ?? client;
  const [messages, setMessages] = useState<Messages>([]);
  const messageId = React.useRef(0);
  const outputSessions = React.useRef(createOutputSessionGate());
  const cachedMessagesRef = React.useRef<Messages>([]);
  const messagesTimeoutRef = React.useRef<number | null>(null);

  const sendMessage = useCallback(
    (level: "error" | "info", title: string, msgs: unknown[]) => {
      cachedMessagesRef.current.push(
        captureOutputEntry(
          level,
          title,
          msgs,
          ++messageId.current,
          outputClient,
          isExampleWallet,
        ),
      );

      if (messagesTimeoutRef.current) {
        return;
      }

      messagesTimeoutRef.current = window.setTimeout(() => {
        const toAdd = cachedMessagesRef.current.splice(0);
        setMessages((prevMessages) => [...prevMessages, ...toAdd]);
        messagesTimeoutRef.current = null;
      }, 100);
    },
    [outputClient, isExampleWallet],
  );

  useEffect(() => {
    const sessions = outputSessions.current;
    return () => {
      sessions.invalidate();
      if (messagesTimeoutRef.current) {
        clearTimeout(messagesTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    // Late callbacks from a previous wallet/network must not append to the new context.
    outputSessions.current.invalidate();
  }, [client, signer]);

  const beginOutputRun = useCallback(() => {
    const isCurrent = outputSessions.current.begin();
    let reportedTerminal = false;
    return {
      isCurrent,
      terminalError: (error: unknown) => {
        if (reportedTerminal) {
          return;
        }
        reportedTerminal = true;
        // sendMessage captures the original run client and wallet mode.
        sendMessage(
          "error",
          isCurrent()
            ? "Execution failed"
            : "Execution failed after wallet/network changed",
          [error],
        );
      },
      log: (level: "error" | "info", title: string, msgs: unknown[]) => {
        if (isCurrent()) {
          sendMessage(level, title, msgs);
        }
      },
    };
  }, [sendMessage]);

  useEffect(() => {
    const handler = (event: PromiseRejectionEvent) => {
      const name =
        event.reason instanceof Error ? event.reason.name : "Unknown Error";
      sendMessage(
        "error",
        `${formatTimestamp(Date.now())} Global async error (unattributed): ${name}`,
        event.reason instanceof Error
          ? [event.reason]
          : [
              new Error(
                "Unhandled promise rejection (original reason follows)",
              ),
              event.reason,
            ],
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
        isExampleWallet,
        enableExampleWallet: () => {
          if (!cccSigner) {
            setExampleEnabled(true);
          }
        },
        openSigner: () => {
          // Choosing a real wallet is explicit, and never resumes execution.
          setExampleEnabled(false);
          return open();
        },
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

        messages,
        beginOutputRun,
        clearMessage: () => {
          // Clear history and queued entries, not the currently running script.
          if (messagesTimeoutRef.current) {
            clearTimeout(messagesTimeoutRef.current);
            messagesTimeoutRef.current = null;
          }
          setMessages([]);
          cachedMessagesRef.current.length = 0;
        },
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
