import * as bitcoin from "bitcoinjs-lib";

/**
 * Check if a script pubkey is an OP_RETURN script.
 *
 * A valid OP_RETURN script should have the following structure:
 * - <OP_RETURN code> <size: n> <data of n bytes>
 * - <OP_RETURN code> <OP_PUSHDATA1> <size: n> <data of n bytes>
 *
 * @example
 * // <OP_RETURN> <size: 0x04> <data: 01020304>
 * isOpReturnScriptPubkey(ccc.bytesFrom('6a0401020304')); // true
 * // <OP_RETURN> <OP_PUSHDATA1> <size: 0x0f> <data: 746573742d636f6d6d69746d656e74>
 * isOpReturnScriptPubkey(ccc.bytesFrom('6a4c0f746573742d636f6d6d69746d656e74')); // true
 * // <OP_RETURN> <OP_PUSHDATA1>
 * isOpReturnScriptPubkey(ccc.bytesFrom('6a4c')); // false
 * // <OP_RETURN> <size: 0x01>
 * isOpReturnScriptPubkey(ccc.bytesFrom('6a01')); // false
 * // <OP_DUP> ... (not an OP_RETURN script)
 * isOpReturnScriptPubkey(ccc.bytesFrom('76a914a802fc56c704ce87c42d7c92eb75e7896bdc41e788ac')); // false
 */
export function isOpReturnScriptPubkey(script: Uint8Array): boolean {
  const scripts = bitcoin.script.decompile(script);
  if (!scripts || scripts.length !== 2) {
    return false;
  }

  const [op, data] = scripts;
  // OP_RETURN opcode is 0x6a in hex or 106 in integer
  if (op !== bitcoin.opcodes.OP_RETURN) {
    return false;
  }
  // Standard OP_RETURN data size is up to 80 bytes
  if (
    !(data instanceof Uint8Array) ||
    data.byteLength < 1 ||
    data.byteLength > 80
  ) {
    return false;
  }

  // No false condition matched, it's an OP_RETURN script
  return true;
}
