"use client";

import { ccc } from "@ckb-ccc/connector-react";
import { useEffect, useRef, useState, useCallback } from "react";
import { useApp } from "./context";
import {
  Blocks,
  BookOpenText,
  Bug,
  Coins,
  FlaskConical,
  FlaskConicalOff,
  Play,
  Printer,
  Send,
  SquareArrowOutUpRight,
  SquareTerminal,
  StepForward,
} from "lucide-react";
import { Button } from "./components/Button";
import { Transaction } from "./tabs/Transaction";
import { Scripts } from "./tabs/Scripts";
import { DEFAULT_TRANSFER, DEFAULT_UDT_TRANSFER } from "./examples";
import html2canvas from "html2canvas";
import { About } from "./tabs/About";
import { Console } from "./tabs/Console";
import axios from "axios";
import { execute } from "./execute";
import { Editor } from "./components/Editor";

export default function Home() {
  const { openSigner, openAction, signer, messages, sendMessage } = useApp();
  const { setClient, client } = ccc.useCcc();

  const [isLoading, setIsLoading] = useState(false);
  const [source, setSource] = useState(DEFAULT_TRANSFER);
  const [isRunning, setIsRunning] = useState(false);
  const [next, setNext] = useState<((abort?: boolean) => void) | undefined>(
    undefined
  );

  const [tx, setTx] = useState<ccc.Transaction | undefined>(undefined);
  const tabRef = useRef<HTMLDivElement | null>(null);

  const [tab, setTab] = useState("Transaction");
  const [readMsgCount, setReadMsgCount] = useState(0);
  const [highlight, setHighlight] = useState<number[] | undefined>(undefined);

  const [isTestnet, setIsTestnet] = useState(true);
  useEffect(() => {
    setIsTestnet(client.addressPrefix !== "ckb");
  }, [client]);
  useEffect(() => {
    setClient(
      isTestnet ? new ccc.ClientPublicTestnet() : new ccc.ClientPublicMainnet()
    );
  }, [isTestnet, setClient]);

  const runCode = useCallback(
    async (autoPlay: boolean) => {
      setIsRunning(true);
      try {
        await execute(
          source,
          (pos, tx) => {
            if (tx) {
              setTx(ccc.Transaction.from({ ...tx }));
            }

            setHighlight(pos);
            if (!pos) {
              return Promise.resolve();
            }
            return new Promise<void>((resolve, reject) => {
              const next = (abort?: boolean) => {
                setNext(undefined);

                if (abort) {
                  reject("ABORTED");
                } else {
                  resolve();
                }
              };
              setNext(() => next);
              if (autoPlay) {
                setTimeout(next, 500);
              }
            });
          },
          signer,
          sendMessage
        );
      } finally {
        setIsRunning(false);
      }
    },
    [source, signer, sendMessage]
  );

  useEffect(() => {
    if (next) {
      next(true);
    }

    window.localStorage.setItem("playgroundSourceCode", source);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [source]);

  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    const src = searchParams.get("src");

    if (src == null) {
      const source = window.localStorage.getItem("playgroundSourceCode");
      if (source) {
        setSource(source);
      }
      return;
    }

    setIsLoading(true);
    axios.get(src).then(({ data }) => {
      setSource(data);
      setIsLoading(false);
    });
  }, []);

  useEffect(() => {
    if (tab === "Console") {
      setReadMsgCount(messages.length);
      return;
    }

    if (messages.slice(readMsgCount).some(([level]) => level === "error")) {
      setTab("Console");
    }
  }, [messages, tab, readMsgCount]);

  return (
    <div
      className={`flex flex-col w-full min-h-dvh ${
        tab !== "Print" ? "lg:h-dvh lg:flex-row" : ""
      }`}
    >
      <div
        className={`basis-1/2 shrink-0 flex flex-col overflow-hidden lg:h-dvh ${
          tab !== "Print" ? "" : "hidden"
        }`}
      >
        <Editor
          value={source}
          onChange={(v) => setSource(v ?? "")}
          isLoading={isLoading}
          highlight={highlight}
        />
        <div className="flex overflow-x-auto bg-gray-800 shrink-0">
          <Button onClick={() => setIsTestnet(!isTestnet)}>
            {isTestnet ? (
              <FlaskConical size="16" />
            ) : (
              <FlaskConicalOff size="16" />
            )}
            <span className="ml-1">{isTestnet ? "Testnet" : "Mainnet"}</span>
          </Button>
          {isRunning ? (
            <Button onClick={() => next?.()} disabled={!next}>
              <StepForward size="16" />
              <span className="ml-1">Continue</span>
            </Button>
          ) : (
            <>
              <Button onClick={() => runCode(true)}>
                <Play size="16" />
                <span className="ml-1">Run</span>
              </Button>
              <Button onClick={() => runCode(false)}>
                <Bug size="16" />
                <span className="ml-1">Step</span>
              </Button>
            </>
          )}
          <Button onClick={() => setSource(DEFAULT_TRANSFER)}>
            <Send size="16" />
            <span className="ml-1">Example: Transfer</span>
          </Button>
          <Button onClick={() => setSource(DEFAULT_UDT_TRANSFER)}>
            <Coins size="16" />
            <span className="ml-1">Example: UDT Transfer</span>
          </Button>
        </div>
      </div>
      <div className="flex flex-col basis-1/2 grow shrink-0 overflow-hidden">
        {
          {
            Transaction: <Transaction tx={tx} onRun={() => runCode(true)} />,
            Scripts: <Scripts tx={tx} />,
            Console: <Console />,
            Print: <Transaction tx={tx} disableScroll innerRef={tabRef} />,
            About: <About className="p-4 grow" />,
          }[tab]
        }
        <div className="flex overflow-x-auto bg-gray-800 shrink-0">
          <Button onClick={openSigner}>{openAction}</Button>
          <Button onClick={() => setTab("Transaction")}>
            <Blocks size="16" />
            <span className="ml-1">Transaction</span>
          </Button>
          <Button onClick={() => setTab("Scripts")}>
            <BookOpenText size="16" />
            <span className="ml-1">Scripts</span>
          </Button>
          <Button onClick={() => setTab("Console")}>
            <SquareTerminal size="16" />
            <span className="ml-1">Console</span>
          </Button>
          <Button
            onClick={() => {
              if (tab === "Print" && tabRef.current) {
                html2canvas(tabRef.current, {
                  backgroundColor: "#4a044e",
                  foreignObjectRendering: true,
                }).then((canvas) => {
                  const image = canvas.toDataURL("image/png");
                  const link = document.createElement("a");
                  link.href = image;
                  link.download = "transaction.png";
                  link.click();
                });
              }
              setTab("Print");
            }}
          >
            <Printer size="16" />
            <span className="ml-1">
              Print{tab === "Print" ? " (Click again)" : ""}
            </span>
          </Button>
          <Button onClick={() => setTab("About")}>
            <SquareArrowOutUpRight size="16" />
            <span className="ml-1">About</span>
          </Button>
        </div>
      </div>
    </div>
  );
}
