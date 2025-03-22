"use client";

import { bech32 } from "bech32";
import WebSocket from "isomorphic-ws";
import { ccc } from "@ckb-ccc/connector-react";
import { useEffect, useState, useCallback } from "react";
import { useApp } from "./context";
import {
  Braces,
  Bug,
  FlaskConical,
  FlaskConicalOff,
  Loader,
  Play,
  Share2,
  SquareArrowOutUpRight,
  SquareTerminal,
  StepForward,
  Trash,
} from "lucide-react";
import { Button } from "./components/Button";
import { DEFAULT_TRANSFER } from "./examples";
import { About } from "./tabs/About";
import { Console } from "./tabs/Console";
import axios from "axios";
import { execute } from "./execute";
import { Editor } from "./components/Editor";
import * as prettier from "prettier/standalone";
import * as prettierTs from "prettier/parser-typescript";
import * as prettierEstree from "prettier/plugins/estree";

async function shareToNostr(
  client: ccc.Client,
  relays: string[],
  content: string,
): Promise<string> {
  const event: ccc.NostrEvent = {
    kind: 1050,
    created_at: Math.floor(Date.now() / 1000),
    tags: [
      ["filename", "ccc-playground.ts"],
      ["client", "ccc-playground"],
    ],
    content,
  };
  const signer = new ccc.SignerNostrPrivateKey(
    client,
    Array.from(new Array(32), () => Math.floor(Math.random() * 256)),
  );
  const signedEvent = await signer.signNostrEvent(event);

  const sent = (
    await Promise.all(
      relays.map(async (relay) => {
        const socket = new WebSocket(relay);
        const res = await new Promise<string | undefined>((resolve) => {
          setTimeout(resolve, 5000);
          socket.onclose = () => {
            resolve(undefined);
          };
          socket.onmessage = (event) => {
            const data = JSON.parse(event.data as string);
            if (data[0] === "OK" && data[1] === signedEvent.id && data[2]) {
              resolve(relay);
            } else {
              resolve(undefined);
            }
          };
          socket.onopen = () => {
            socket.send(JSON.stringify(["EVENT", signedEvent]));
          };
        });
        socket.close();
        return res;
      }),
    )
  ).filter((r) => r !== undefined);

  if (sent.length === 0) {
    throw new Error("Failed to send event to relay");
  }

  const id = ccc.bytesFrom(signedEvent.id);
  return bech32.encode(
    "nevent",
    bech32.toWords(
      ccc.bytesConcat(
        [0, id.length],
        id,
        ...sent
          .map((relay) => {
            console.log(relay);
            const bytes = ccc.bytesFrom(relay, "ascii");
            return [[1, bytes.length], bytes];
          })
          .flat(),
      ),
    ),
    65536,
  );
}

function getTLVs(tlv: number[]) {
  let i = 0;

  const values = [];
  while (i < tlv.length) {
    const type = tlv[i];
    const length = tlv[i + 1];
    const value = tlv.slice(i + 2, i + 2 + length);
    i += 2 + length;

    values.push({ type, length, value });
  }

  return values;
}

async function getFromNEvent(
  defaultRelays: string[],
  id: string,
): Promise<string | undefined> {
  let eventId;
  const relays = [...defaultRelays];
  for (const { type, value } of getTLVs(
    bech32.fromWords(bech32.decode(id, 65536).words),
  )) {
    if (type === 0) {
      eventId = ccc.hexFrom(value).slice(2);
    }
    if (type === 1) {
      const relay = ccc.bytesTo(value, "ascii");
      if (!relays.includes(relay)) {
        relays.push(relay);
      }
    }
  }
  if (!eventId) {
    throw new Error("Invalid nevent");
  }

  return Promise.any(relays.map((relay) => getFromNostr(relay, eventId)));
}

async function getFromNostr(relayUrl: string, id: string): Promise<string> {
  const socket = new WebSocket(relayUrl);

  const res = await new Promise<string>((resolve, reject) => {
    setTimeout(() => reject("Timeout"), 10000);
    socket.onclose = () => {
      reject("Connection closed");
    };
    socket.onmessage = (event) => {
      const data = JSON.parse(event.data as string);
      if (data[0] === "EVENT" && data[1] === "1") {
        resolve(data[2].content);
      } else if (data[0] === "EOSE") {
        reject("Event not found");
      } else {
        reject(JSON.stringify(event.data));
      }
    };
    socket.onopen = () => {
      socket.send(JSON.stringify(["REQ", "1", { ids: [id] }]));
    };
  });
  socket.close();

  return res;
}

const DEFAULT_NOSTR_RELAYS = [
  "wss://relay.nostr.band",
  "wss://purplerelay.com",
  "wss://relay.nostr.net",
  "wss://nostr.oxtr.dev",
  "wss://relay.damus.io",
];

export default function Home() {
  const {
    openSigner,
    openAction,
    signer,
    messages,
    sendMessage,
    clearMessage,
  } = useApp();
  const { setClient, client } = ccc.useCcc();

  const [isLoading, setIsLoading] = useState(false);
  const [source, setSource] = useState(DEFAULT_TRANSFER);
  const [isRunning, setIsRunning] = useState(false);
  const [next, setNext] = useState<((abort?: boolean) => void) | undefined>(
    undefined,
  );

  const [tab, setTab] = useState("Console");
  const [readMsgCount, setReadMsgCount] = useState(0);
  const [highlight, setHighlight] = useState<number[] | undefined>(undefined);

  const [isTestnet, setIsTestnet] = useState(true);
  useEffect(() => {
    setIsTestnet(client.addressPrefix !== "ckb");
  }, [client]);
  useEffect(() => {
    setClient(
      isTestnet ? new ccc.ClientPublicTestnet() : new ccc.ClientPublicMainnet(),
    );
  }, [isTestnet, setClient]);

  const runCode = useCallback(
    async (autoPlay: boolean) => {
      setIsRunning(true);
      try {
        await execute(
          source,
          (pos) => {
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
          sendMessage,
        );
      } finally {
        setIsRunning(false);
      }
    },
    [source, signer, sendMessage],
  );

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

    if (src.startsWith("nostr:")) {
      const id = src.slice(6);
      getFromNEvent(DEFAULT_NOSTR_RELAYS, id)
        .then((res) => {
          if (res !== undefined) {
            setSource(res);
          }
        })
        .finally(() => setIsLoading(false));
    } else {
      axios
        .get(src)
        .then(({ data }) => {
          setSource(data);
        })
        .finally(() => setIsLoading(false));
    }
  }, []);

  useEffect(() => {
    if (next) {
      next(true);
    }

    const searchParams = new URLSearchParams(window.location.search);
    const src = searchParams.get("src");

    if (src == null) {
      window.localStorage.setItem("playgroundSourceCode", source);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [source]);

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
    <div className="flex min-h-dvh w-full flex-col lg:h-dvh lg:flex-row">
      <div className="flex shrink-0 basis-1/2 flex-col overflow-hidden lg:h-dvh">
        <Editor
          value={source}
          onChange={(v) => setSource(v ?? "")}
          isLoading={isLoading}
          highlight={highlight}
        />
        <div className="flex shrink-0 overflow-x-auto bg-gray-800">
          <Button onClick={() => setIsTestnet(!isTestnet)}>
            {isTestnet ? (
              <FlaskConical size="16" />
            ) : (
              <FlaskConicalOff size="16" />
            )}
            <span className="ml-1">{isTestnet ? "Testnet" : "Mainnet"}</span>
          </Button>
          <Button
            onClick={() =>
              prettier
                .format(source, {
                  parser: "typescript",
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  plugins: [prettierTs, prettierEstree as any],
                })
                .then(setSource)
            }
          >
            <Braces size="16" />
            <span className="ml-1">Format</span>
          </Button>
          {isRunning ? (
            next ? (
              <Button onClick={() => next?.()}>
                <StepForward size="16" />
                <span className="ml-1">Continue</span>
              </Button>
            ) : (
              <Button>
                <Loader className="animate-spin" size="16" />
                <span className="ml-1">Running</span>
              </Button>
            )
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
          <Button
            onClick={async () => {
              const id = await shareToNostr(
                client,
                DEFAULT_NOSTR_RELAYS,
                source,
              );

              window.location.href = `/?src=nostr:${id}`;
            }}
          >
            <Share2 size="16" />
            <span className="ml-1">Share</span>
          </Button>
        </div>
      </div>
      <div className="flex shrink-0 grow basis-1/2 flex-col overflow-hidden">
        {
          {
            Console: <Console onRun={() => runCode(true)} />,
            About: <About className="grow p-4" />,
          }[tab]
        }
        <div className="flex shrink-0 overflow-x-auto bg-gray-800">
          <Button onClick={openSigner}>{openAction}</Button>
          <Button onClick={() => setTab("Console")}>
            <SquareTerminal size="16" />
            <span className="ml-1">Console</span>
          </Button>
          <Button onClick={clearMessage}>
            <Trash size="16" />
            <span className="ml-1">Clear</span>
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
