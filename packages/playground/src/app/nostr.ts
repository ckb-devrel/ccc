import { ccc } from "@ckb-ccc/ccc";
import { schnorr } from "@noble/curves/secp256k1.js";
import { bech32 } from "bech32";
import WebSocket from "isomorphic-ws";

function openWebSocket(url: string): ccc.Owner<WebSocket> {
  const socket = new WebSocket(url);
  return new ccc.OwnerUnique(socket, async (socket) => {
    if (socket.readyState === socket.CLOSED) {
      return;
    }

    await new Promise<void>((resolve) => {
      const finish = () => {
        window.clearTimeout(timeout);
        socket.removeEventListener("close", finish);
        resolve();
      };
      const timeout = window.setTimeout(finish, 1000);
      socket.addEventListener("close", finish, { once: true });
      socket.onopen = null;
      socket.onclose = null;
      socket.onerror = null;
      socket.onmessage = null;
      if (socket.readyState !== socket.CLOSING) {
        socket.close();
      }
    });
  });
}

export async function shareToNostr(
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
    crypto.getRandomValues(new Uint8Array(32)),
  );
  const signedEvent = await signer.signNostrEvent(event);

  const sent = (
    await Promise.all(
      relays.map(async (relay) => {
        const socketOwner = openWebSocket(relay);
        const socket = socketOwner.value;
        let timeout: number | undefined;
        try {
          return await new Promise<string | undefined>((resolve) => {
            timeout = window.setTimeout(resolve, 5000);
            socket.onclose = () => {
              resolve(undefined);
            };
            socket.onerror = () => resolve(undefined);
            socket.onmessage = (event) => {
              try {
                const data = JSON.parse(event.data as string);
                if (
                  Array.isArray(data) &&
                  data[0] === "OK" &&
                  data[1] === signedEvent.id
                ) {
                  if (data[2] === true) {
                    resolve(relay);
                  } else if (data[2] === false) {
                    resolve(undefined);
                  }
                }
              } catch (_err) {
                // Unrelated or malformed relay frames are not acknowledgments.
              }
            };
            socket.onopen = () => {
              socket.send(JSON.stringify(["EVENT", signedEvent]));
            };
          });
        } finally {
          window.clearTimeout(timeout);
          await socketOwner.dispose();
        }
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
            const bytes = ccc.bytesFrom(relay, "utf8");
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

export async function getFromNEvent(
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
      const relay = ccc.bytesTo(value, "utf8");
      if (!relays.includes(relay)) {
        relays.push(relay);
      }
    }
  }
  if (!eventId) {
    throw new Error("Invalid nevent");
  }

  const aborter = new AbortController();
  const requests = relays.map((relay) =>
    getFromNostr(relay, eventId, aborter.signal),
  );
  try {
    return await Promise.any(requests);
  } finally {
    aborter.abort();
    await Promise.allSettled(requests);
  }
}

/** A relay cannot replace the content addressed by a shared nevent. */
function validatedPlaygroundContent(
  value: unknown,
  requestedId: string,
): string | undefined {
  if (!value || typeof value !== "object") {
    return;
  }
  const event = value as Record<string, unknown>;
  const hex = (value: unknown, length: number): value is string =>
    typeof value === "string" &&
    new RegExp(`^[0-9a-f]{${length}}$`).test(value);
  if (
    !hex(event.id, 64) ||
    event.id !== requestedId ||
    !hex(event.pubkey, 64) ||
    !hex(event.sig, 128) ||
    event.kind !== 1050 ||
    typeof event.created_at !== "number" ||
    !Number.isSafeInteger(event.created_at) ||
    event.created_at < 0 ||
    typeof event.content !== "string" ||
    !Array.isArray(event.tags) ||
    !event.tags.every(
      (tag) =>
        Array.isArray(tag) && tag.every((item) => typeof item === "string"),
    )
  ) {
    return;
  }
  try {
    const hash = ccc.nostrEventHash(event as unknown as ccc.NostrEvent);
    if (
      ccc.hexFrom(hash).slice(2) !== requestedId ||
      !schnorr.verify(
        ccc.bytesFrom(event.sig),
        hash,
        ccc.bytesFrom(event.pubkey),
      )
    ) {
      return;
    }
    return event.content;
  } catch {
    return;
  }
}

async function getFromNostr(
  relayUrl: string,
  id: string,
  signal: AbortSignal,
): Promise<string> {
  const socketOwner = openWebSocket(relayUrl);
  const socket = socketOwner.value;
  let timeout: number | undefined;
  let abort: (() => void) | undefined;
  try {
    return await new Promise<string>((resolve, reject) => {
      timeout = window.setTimeout(() => reject(new Error("Timeout")), 10000);
      abort = () => reject(new Error("Aborted"));
      signal.addEventListener("abort", abort, { once: true });
      socket.onclose = () => {
        reject(new Error("Connection closed"));
      };
      socket.onerror = () => reject(new Error("Connection error"));
      socket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data as string);
          if (!Array.isArray(data)) {
            return;
          }
          if (data[0] === "EVENT" && data[1] === "1") {
            const content = validatedPlaygroundContent(data[2], id);
            if (content !== undefined) {
              resolve(content);
            }
          } else if (data[0] === "EOSE" && data[1] === "1") {
            reject(new Error("Event not found"));
          } else if (data[0] === "CLOSED" && data[1] === "1") {
            reject(new Error("Subscription closed"));
          }
          // NOTICE and frames for another subscription do not end this request.
        } catch (_err) {
          // Ignore malformed frames and wait for a valid event or terminal state.
        }
      };
      socket.onopen = () => {
        socket.send(JSON.stringify(["REQ", "1", { ids: [id] }]));
      };
    });
  } finally {
    window.clearTimeout(timeout);
    if (abort) {
      signal.removeEventListener("abort", abort);
    }
    await socketOwner.dispose();
  }
}

export const DEFAULT_NOSTR_RELAYS = [
  "wss://relay.nostr.band",
  "wss://purplerelay.com",
  "wss://relay.nostr.net",
  "wss://nostr.oxtr.dev",
  "wss://relay.damus.io",
];
