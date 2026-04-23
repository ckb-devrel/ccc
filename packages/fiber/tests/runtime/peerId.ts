/**
 * Peer ID utilities for Fiber / libp2p nodes.
 *
 * The fiber-wasm uses the tentacle/secio peer-identity scheme:
 * PeerId = base58(multihash(SHA256, SHA256(pubkeyBytes)))
 *
 * node_info.node_id returns a hex-encoded secp256k1 public key (possibly the
 * CKB key, not the fiber P2P key). To build a valid /p2p/<PeerId> multiaddr
 * for connecting peers, derive the PeerId from the fiber key pair directly
 * via fiberKeyPairToBase58PeerId().
 *
 * @see https://github.com/driftluo/tentacle/blob/87ef6d9bd659012bb1394f5f3e8ccd4f8e615197/secio/src/peer_id.rs#L59-L73
 */
import { secp256k1 } from "@noble/curves/secp256k1";
import bs58 from "bs58";
import { createHash } from "node:crypto";

/**
 * Derive the libp2p base58 PeerId (Qm...) from a 33-byte compressed
 * secp256k1 public key using the tentacle/secio SHA256 multihash scheme.
 */
export function pubkeyBytesToBase58PeerId(pubkey: Uint8Array): string {
  if (pubkey.length !== 33) return "";
  const digest = createHash("sha256").update(pubkey).digest();
  const multihash = new Uint8Array(2 + 32);
  multihash[0] = 0x12; // SHA2-256 code
  multihash[1] = 0x20; // 32-byte length
  multihash.set(digest, 2);
  return bs58.encode(multihash);
}

/**
 * Derive the libp2p base58 PeerId from a 32-byte fiber private key.
 * This is the identity that fiber-wasm uses for libp2p P2P connections.
 */
export function fiberKeyPairToBase58PeerId(fiberKeyPair: Uint8Array): string {
  if (fiberKeyPair.length !== 32) return "";
  const pubkey = secp256k1.getPublicKey(fiberKeyPair, true);
  return pubkeyBytesToBase58PeerId(pubkey);
}

/**
 * Convert a hex-encoded node_id (from node_info RPC) to a base58 PeerId.
 * node_info may return the CKB key (32 or 33 bytes hex) rather than the fiber
 * P2P key. Prefer fiberKeyPairToBase58PeerId() for building valid multiaddrs.
 *
 * Uses the libp2p PublicKey protobuf encoding (KeyType=Secp256k1) before
 * hashing — which is the format used by node_info's identity key.
 */
export function hexPeerIdToBase58(hex: string): string {
  const raw = hex.replace(/^0x/i, "").trim();
  if (!/^[0-9a-fA-F]+$/.test(raw)) return hex;
  const len = raw.length;
  if (len !== 64 && len !== 66) return hex;

  let pubkeyBytes = Buffer.from(raw, "hex");
  // If 32-byte raw key, prepend compression prefix
  if (pubkeyBytes.length === 32) {
    const compressed = Buffer.alloc(33);
    compressed[0] = 0x02;
    pubkeyBytes.copy(compressed, 1);
    pubkeyBytes = compressed;
  }
  if (pubkeyBytes.length !== 33) return hex;

  // Libp2p PublicKey protobuf: field 1 = KeyType (Secp256k1=2), field 2 = Data
  const protobuf = Buffer.alloc(2 + 2 + 33);
  let off = 0;
  protobuf[off++] = 0x08; // field 1, varint
  protobuf[off++] = 0x02; // Secp256k1
  protobuf[off++] = 0x12; // field 2, bytes
  protobuf[off++] = 0x21; // 33 bytes
  pubkeyBytes.copy(protobuf, off);

  const digest = createHash("sha256").update(protobuf).digest();
  const multihash = new Uint8Array(2 + 32);
  multihash[0] = 0x12;
  multihash[1] = 0x20;
  multihash.set(digest, 2);
  return bs58.encode(multihash);
}
