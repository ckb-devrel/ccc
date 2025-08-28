import { schnorr } from "@noble/curves/secp256k1";
import { sha256 } from "@noble/hashes/sha2.js";
import { bech32 } from "bech32";
import { Bytes, BytesLike, bytesFrom } from "../../bytes/index.js";
import { hexFrom } from "../../hex/index.js";
import { NostrEvent } from "./signerNostr.js";

/**
 * @public
 */
export function buildNostrEventFromMessage(
  message: string | BytesLike,
): NostrEvent {
  if (typeof message === "string") {
    try {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const event = JSON.parse(message);
      if (
        typeof event === "object" &&
        typeof event.created_at === "number" &&
        typeof event.kind === "number" &&
        typeof event.content === "string" &&
        Array.isArray(event.tags) &&
        (event.tags as unknown[]).every(
          (tag) =>
            Array.isArray(tag) &&
            (tag as unknown[]).every((v) => typeof v === "string"),
        )
      ) {
        return event as NostrEvent;
      }
    } catch (_) {}
  }

  return {
    kind: 23335,
    created_at: 0,
    content: typeof message === "string" ? message : hexFrom(message),
    tags: [],
  };
}

export function nostrEventHash(event: NostrEvent): Bytes {
  const serialized = JSON.stringify([
    0,
    event.pubkey,
    event.created_at,
    event.kind,
    event.tags,
    event.content,
  ]);

  return sha256(bytesFrom(serialized, "utf8"));
}

export function verifyMessageNostrEvent(
  message: string | BytesLike,
  signature: string,
  address: string,
): boolean {
  const { words } = bech32.decode(address);
  const pubkey = hexFrom(bech32.fromWords(words)).slice(2);

  const event = buildNostrEventFromMessage(message);
  const eventHash = nostrEventHash({ ...event, pubkey });

  try {
    return schnorr.verify(hexFrom(signature).slice(2), eventHash, pubkey);
  } catch (_) {
    return false;
  }
}
