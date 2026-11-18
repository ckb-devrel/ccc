/** A real occupied/total percentage; unknown or invalid cells have no ratio. */
export function capacityOccupiedPercent(capacity?: bigint, occupied?: bigint) {
  if (
    capacity === undefined ||
    occupied === undefined ||
    capacity <= BigInt(0) ||
    occupied < BigInt(0) ||
    occupied > capacity
  ) {
    return undefined;
  }
  return Number((occupied * BigInt(1000000)) / capacity) / 10000;
}
