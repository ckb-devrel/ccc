import { ccc } from "@ckb-ccc/core";
import {
  SporeScriptInfo,
  SporeScriptInfoLike,
  getMutantScriptInfo,
  getMutantScriptInfos,
} from "../predefined/index.js";

/**
 * Size bounds of a native Mutant's ELF, mirrored from the
 * `spore_extension_rust` contract (spore-contract#75).
 */
export const NATIVE_MUTANT_CODE_MIN_SIZE = 64;
export const NATIVE_MUTANT_CODE_MAX_SIZE = 256 * 1024;

/**
 * Preflight a native Mutant's RISC-V ELF the same way the Mutant
 * extension contract does at creation: size within bounds, and an
 * ELF64/little-endian/version-1 executable header targeting RISC-V.
 *
 * The CKB VM stays the authority on executability; this only catches
 * obvious mistakes before the transaction is built.
 *
 * @returns the checked bytes
 */
export function checkNativeMutantCode(code: ccc.BytesLike): Uint8Array {
  const bytes = ccc.bytesFrom(code);
  if (
    bytes.length < NATIVE_MUTANT_CODE_MIN_SIZE ||
    bytes.length > NATIVE_MUTANT_CODE_MAX_SIZE
  ) {
    throw new Error(
      `Native Mutant code must be ${NATIVE_MUTANT_CODE_MIN_SIZE}..${NATIVE_MUTANT_CODE_MAX_SIZE} bytes, got ${bytes.length}`,
    );
  }

  const magic = bytes.slice(0, 7);
  if (
    magic[0] !== 0x7f ||
    magic[1] !== 0x45 /* E */ ||
    magic[2] !== 0x4c /* L */ ||
    magic[3] !== 0x46 /* F */ ||
    magic[4] !== 2 /* 64-bit */ ||
    magic[5] !== 1 /* little-endian */ ||
    magic[6] !== 1 /* version */
  ) {
    throw new Error(
      "Native Mutant code must be an ELF64 little-endian version-1 ELF",
    );
  }

  const eType = bytes[16] | (bytes[17] << 8);
  const eMachine = bytes[18] | (bytes[19] << 8);
  if (eType !== 2) {
    throw new Error("Native Mutant code must be an executable ELF (ET_EXEC)");
  }
  if (eMachine !== 243 /* EM_RISCV */) {
    throw new Error("Native Mutant code must target RISC-V (EM_RISCV)");
  }

  return bytes;
}

/**
 * Build a Mutant type script's args: the 32-byte Mutant ID, optionally
 * followed by an 8-byte little-endian minimal mint payment in shannons.
 */
export function buildMutantArgs(
  mutantId: ccc.HexLike,
  payment?: ccc.NumLike,
): ccc.Hex {
  const id = ccc.hexFrom(mutantId);
  if (ccc.bytesFrom(id).length !== 32) {
    throw new Error("Mutant ID must be 32 bytes");
  }
  if (payment === undefined) {
    return id;
  }
  const threshold = ccc.numFrom(payment);
  if (threshold < 0n || threshold > 0xffffffffffffffffn) {
    throw new Error("Mutant payment must be a uint64");
  }
  return ccc.hexFrom([...ccc.bytesFrom(id), ...ccc.numLeToBytes(threshold, 8)]);
}

/**
 * Append the `mutant[]` content-type parameter with the given Mutant IDs.
 *
 * The Spore contract (spore-contract#75) recognizes Mutant IDs as
 * comma-separated 64-character hex strings without a `0x` prefix.
 */
export function withMutants(
  contentType: string,
  mutantIds: ccc.HexLike[],
): string {
  if (
    contentTypeParameters(contentType).some(([name]) => name === "mutant[]")
  ) {
    throw new Error("Content type already has a mutant[] parameter");
  }
  if (mutantIds.length === 0) {
    throw new Error("At least one Mutant ID is required");
  }
  const ids = mutantIds.map((id) => {
    const bytes = ccc.bytesFrom(id);
    if (bytes.length !== 32) {
      throw new Error("Mutant ID must be 32 bytes");
    }
    return ccc.hexFrom(bytes).slice(2);
  });
  if (new Set(ids).size !== ids.length) {
    throw new Error("Duplicate Mutant ID");
  }
  return `${contentType.replace(/[ \t;]+$/, "")};mutant[]=${ids.join(",")}`;
}

function contentTypeParameters(contentType: string): [string, string][] {
  // The contract treats ';' as a parameter delimiter even inside quoted values.
  // Only SP/HTAB are optional whitespace; a space around '=' changes the key.
  const parts = contentType.trim().split(";").slice(1);
  const result: [string, string][] = [];
  for (const [index, part] of parts.entries()) {
    if (/^[ \t]*$/.test(part) && index === parts.length - 1) {
      continue;
    }
    const equal = part.indexOf("=");
    const name = part.slice(0, equal).replace(/^[ \t]+/, "");
    const value = part.slice(equal + 1).replace(/[ \t]+$/, "");
    if (
      equal < 0 ||
      !/^(?:mutant\[\]|[a-zA-Z0-9*][a-zA-Z0-9!#$&^_.+%*'-]*)$/.test(name) ||
      !/^(?:"(?:[^"\\\n]|\\[^\n])*"|[a-zA-Z0-9!#$&^_.+%*',-]*)$/.test(value)
    ) {
      throw new Error("Invalid content-type parameter");
    }
    result.push([name, value]);
  }
  return result;
}

/**
 * Parse the `mutant[]` parameter of a Spore content type, mirroring the
 * contract's MIME parser: throws on malformed IDs so invalid content
 * types fail before reaching the chain.
 *
 * @returns the parsed Mutant IDs, empty if no `mutant[]` is present
 */
export function getMutantIds(contentType: string): ccc.Hex[] {
  const ids: ccc.Hex[] = [];
  const seen = new Set<ccc.Hex>();
  for (const [name, value] of contentTypeParameters(contentType)) {
    if (name !== "mutant[]") {
      continue;
    }
    for (const id of value.split(",")) {
      if (!/^[0-9a-fA-F]{64}$/.test(id)) {
        throw new Error(
          "Invalid Mutant ID: expected 64 hex characters without 0x prefix",
        );
      }
      const normalized = ccc.hexFrom(id.toLowerCase());
      if (seen.has(normalized)) {
        throw new Error("Duplicate Mutant ID");
      }
      seen.add(normalized);
      ids.push(normalized);
    }
  }
  return ids;
}

/**
 * Search an on-chain Mutant cell by its ID.
 */
export async function findMutant(
  client: ccc.Client,
  id: ccc.HexLike,
  scripts?: SporeScriptInfoLike[],
): Promise<
  | {
      cell: ccc.Cell;
      scriptInfo: SporeScriptInfo;
    }
  | undefined
> {
  const mutantId = ccc.hexFrom(id);
  if (ccc.bytesFrom(mutantId).length !== 32) {
    throw new Error("Mutant ID must be 32 bytes");
  }
  let found: { cell: ccc.Cell; scriptInfo: SporeScriptInfo } | undefined;
  for (const info of scripts ?? Object.values(getMutantScriptInfos(client))) {
    if (!info) {
      continue;
    }
    const scriptInfo = SporeScriptInfo.from(info);
    for await (const cell of client.findCells({
      script: { ...scriptInfo, args: mutantId },
      scriptType: "type",
      scriptSearchMode: "prefix",
      withData: true,
    })) {
      const type = cell.cellOutput.type;
      if (
        !type ||
        type.codeHash !== scriptInfo.codeHash ||
        type.hashType !== scriptInfo.hashType
      ) {
        continue;
      }
      const args = ccc.bytesFrom(type.args);
      if (
        (args.length !== 32 && args.length !== 40) ||
        ccc.hexFrom(args.slice(0, 32)) !== mutantId
      ) {
        continue;
      }
      if (found && !found.cell.outPoint.eq(cell.outPoint)) {
        throw new Error(`Ambiguous Mutant ID ${mutantId}`);
      }
      found = { cell, scriptInfo };
    }
  }
  return found;
}

/**
 * Add a Mutant cell as a code dependency so Spore can execute it.
 */
export function addMutantCellDep(
  tx: ccc.Transaction,
  outPoint: ccc.OutPointLike,
): void {
  tx.addCellDeps({ outPoint, depType: "code" });
}

/**
 * Resolve Mutant cells by ID and add them as code dependencies.
 *
 * Use this before minting, transferring or melting a Spore whose content
 * type declares Mutants. Include all IDs returned by getMutantIds; the
 * contract requires the rule dependencies on every lifecycle operation.
 */
export async function injectMutantReferences(params: {
  client: ccc.Client;
  tx: ccc.Transaction;
  mutantIds: ccc.HexLike[];
  scripts?: SporeScriptInfoLike[];
}): Promise<void> {
  const { client, tx, mutantIds, scripts } = params;
  for (const id of mutantIds) {
    const found = await findMutant(client, id, scripts);
    if (!found) {
      throw new Error(`Mutant ${ccc.hexFrom(id)} not found`);
    }
    addMutantCellDep(tx, found.cell.outPoint);
  }
}

/**
 * Verify that a transaction satisfies the minimal mint payments declared
 * by the given Mutant cells, mirroring the contract's accounting: for
 * each lock hash, the outputs held by that lock must cover its inputs
 * plus the accumulated thresholds of all its paying Mutants.
 */
export async function checkMutantPayments(params: {
  client: ccc.Client;
  tx: ccc.TransactionLike;
  mutantOutPoints: ccc.OutPointLike[];
}): Promise<void> {
  const { client, mutantOutPoints } = params;
  const tx = ccc.Transaction.from(params.tx);

  // Accumulate thresholds by the Mutant cells' lock hashes
  const thresholds = new Map<ccc.Hex, bigint>();
  for (const outPointLike of mutantOutPoints) {
    const cell = await client.getCell(outPointLike);
    if (!cell || !cell.cellOutput.type) {
      throw new Error("Mutant cell not found");
    }
    const args = ccc.bytesFrom(cell.cellOutput.type.args);
    if (args.length !== 40) {
      continue; // no payment declared
    }
    const threshold = ccc.numFromBytes(args.slice(32));
    const lockHash = ccc.Script.from(cell.cellOutput.lock).hash();
    thresholds.set(
      lockHash,
      (thresholds.get(lockHash) ?? 0n) + ccc.numFrom(threshold),
    );
  }
  if (thresholds.size === 0) {
    return;
  }

  const inputSum = new Map<ccc.Hex, bigint>();
  for (const input of tx.inputs) {
    const cell = await client.getCell(input.previousOutput);
    if (!cell) {
      throw new Error("Input cell not found");
    }
    const lockHash = ccc.Script.from(cell.cellOutput.lock).hash();
    if (!thresholds.has(lockHash)) {
      continue;
    }
    inputSum.set(
      lockHash,
      (inputSum.get(lockHash) ?? 0n) + ccc.numFrom(cell.cellOutput.capacity),
    );
  }

  const outputSum = new Map<ccc.Hex, bigint>();
  tx.outputs.forEach((output) => {
    const lockHash = ccc.Script.from(output.lock).hash();
    if (!thresholds.has(lockHash)) {
      return;
    }
    outputSum.set(
      lockHash,
      (outputSum.get(lockHash) ?? 0n) + ccc.numFrom(output.capacity),
    );
  });

  for (const [lockHash, threshold] of thresholds) {
    const input = inputSum.get(lockHash) ?? 0n;
    const output = outputSum.get(lockHash) ?? 0n;
    if (input + threshold > output) {
      throw new Error(
        `Mutant payment not enough: lock ${lockHash} requires ${input + threshold} shannons in outputs, got ${output}`,
      );
    }
  }
}

/**
 * Create a native Rust Mutant: an immutable cell whose data is a RISC-V
 * ELF executed by the Spore contract through CKB-VM2 spawn/wait
 * (spore-contract#75). The contract runs the ELF once at creation.
 *
 * The v3 Mutant preset is empty until the contracts are deployed; pass
 * `scriptInfo` explicitly to target a custom or pre-release deployment.
 *
 * @param params.signer who takes the responsibility to balance and sign the transaction
 * @param params.code the RISC-V ELF stored as the Mutant cell's data
 * @param params.payment optional minimal mint payment in shannons, appended to the Mutant ID
 * @param params.to the owner of the Mutant cell, which will be replaced with signer if not provided
 * @param params.tx the transaction skeleton, if not provided, a new one will be created
 * @param params.scriptInfo the Mutant extension script info
 * @returns
 *  - **tx**: a new transaction that contains the created Mutant cell
 *  - **id**: the Mutant ID
 */
export async function createMutant(params: {
  signer: ccc.Signer;
  code: ccc.BytesLike;
  payment?: ccc.NumLike;
  to?: ccc.ScriptLike;
  tx?: ccc.TransactionLike;
  scriptInfo?: SporeScriptInfoLike;
}): Promise<{
  tx: ccc.Transaction;
  id: ccc.Hex;
}> {
  const { signer, payment, to } = params;
  const code = checkNativeMutantCode(params.code);
  const scriptInfo = SporeScriptInfo.from(
    params.scriptInfo ?? getMutantScriptInfo(signer.client),
  );
  if (scriptInfo.hashType !== "data2") {
    throw new Error("Native Mutant deployment requires data2");
  }

  const tx = ccc.Transaction.from(params.tx ?? {});
  await tx.completeInputsAtLeastOne(signer);

  const id = ccc.hashTypeId(tx.inputs[0], tx.outputs.length);
  tx.addOutput(
    {
      lock: to ?? (await signer.getRecommendedAddressObj()).script,
      type: {
        ...scriptInfo,
        args: buildMutantArgs(id, payment),
      },
    },
    code,
  );

  await tx.addCellDepInfos(signer.client, scriptInfo.cellDeps);

  return { tx, id };
}
