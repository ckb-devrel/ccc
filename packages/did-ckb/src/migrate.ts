import { ccc } from "@ckb-ccc/core";
import { DidCkbDataLike, DidCkbWitness } from "./codec";
import { createDidCkb } from "./didCkb";
import {
  getRotationKeys,
  signRotationHash,
  type Curve,
  type PlcOperation,
} from "./plc";

/**
 * Build the migration witness payload that authorizes a did:plc -> did:ckb
 * import. Pure: takes a tx hash + signing material, returns a typed
 * `DidCkbWitness` that the caller wraps in a `WitnessArgs.outputType` field.
 *
 * Per WIP-02 §3.1.1 we send only the genesis operation in `history`. The
 * contract recomputes the genesis CID over the CBOR-encoded op, verifies the
 * self-signature inside it, then verifies `sig` against
 * `history[0].rotationKeys[rotationKeyIndex]`.
 *
 * `selfSigIndex` defaults to 0 because PLC genesis ops are conventionally
 * self-signed by the first rotation key; override if the genesis you're
 * migrating used a different one.
 */
export function buildMigrationWitness(props: {
  txHash: ccc.HexLike;
  genesisOperation: PlcOperation;
  rotationKeyIndex: number;
  rotationPrivateKey: ccc.BytesLike;
  curve?: Curve;
  selfSigIndex?: number;
}): DidCkbWitness {
  const rotationKeys = getRotationKeys(props.genesisOperation);
  if (!rotationKeys[props.rotationKeyIndex]) {
    throw new Error(
      `rotationKeyIndex ${props.rotationKeyIndex} out of range (genesis has ${rotationKeys.length} keys)`,
    );
  }
  const curve = props.curve ?? rotationKeys[props.rotationKeyIndex].curve;
  const sig = signRotationHash(
    props.rotationPrivateKey,
    ccc.bytesFrom(props.txHash),
    curve,
  );
  return DidCkbWitness.from({
    localIdAuthorization: {
      history: [props.genesisOperation as unknown as object],
      sig: ccc.hexFrom(sig),
      rotationKeyIndices: [props.selfSigIndex ?? 0, props.rotationKeyIndex],
    },
  });
}

/**
 * Build a create tx whose output declares an imported did:plc identifier in
 * its `localId` field. Equivalent to calling `createDidCkb` with
 * `data.value.localId = sourceDid`; provided as a named helper for symmetry
 * with the other DID operations and so `did:plc:` migrations have an
 * obvious entry point.
 *
 * The caller is responsible for: completing inputs + fee, building the
 * migration witness with `buildMigrationWitness`, and setting it at the
 * witness slot of input 0. See `packages/examples/src/migrateDid.ts` for the
 * full flow.
 */
export async function migrateDidCkb(props: {
  signer: ccc.Signer;
  sourceDid: string;
  data?: DidCkbDataLike | null;
  receiver?: ccc.ScriptLike | null;
  tx?: ccc.TransactionLike | null;
}): Promise<{
  tx: ccc.Transaction;
  id: ccc.Hex;
  index: number;
}> {
  if (!props.sourceDid.startsWith("did:plc:")) {
    throw new Error(`sourceDid must be did:plc:..., got "${props.sourceDid}"`);
  }
  const document = props.data?.value?.document ?? {};
  const data: DidCkbDataLike = {
    type: props.data?.type ?? "v1",
    value: {
      document,
      localId: props.sourceDid,
    },
  };
  return createDidCkb({
    signer: props.signer,
    data,
    receiver: props.receiver,
    tx: props.tx,
  });
}
