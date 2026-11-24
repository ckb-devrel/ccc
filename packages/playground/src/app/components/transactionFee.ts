/** CCC fee-rate accounting includes four bytes beyond serialized transaction bytes.
 * Input capacity must already include DAO extra capacity, like getInputsCapacity.
 */
export function getSnapshotFee(
  inputCount: number,
  inputCapacity: bigint | undefined,
  outputCapacity: bigint,
  serializedBytes: number,
) {
  const size =
    Number.isSafeInteger(serializedBytes) &&
    serializedBytes > 0 &&
    serializedBytes <= Number.MAX_SAFE_INTEGER - 4
      ? serializedBytes + 4
      : undefined;
  const fee =
    inputCount > 0 &&
    inputCapacity !== undefined &&
    inputCapacity >= outputCapacity &&
    outputCapacity >= BigInt(0)
      ? inputCapacity - outputCapacity
      : undefined;
  return {
    size,
    fee,
    // Match Transaction.getFeeRate: integer division rounds down, not up.
    feeRate:
      fee !== undefined && size !== undefined
        ? (fee * BigInt(1000)) / BigInt(size)
        : undefined,
  };
}
