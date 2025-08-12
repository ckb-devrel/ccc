import { bytesFrom } from "../../bytes/index.js";
import { Cell, CellLike, Script, ScriptLike } from "../../ckb/index.js";
import { HexLike, hexFrom } from "../../hex/index.js";
import { NumLike, numFrom } from "../../num/index.js";
import {
  ClientCollectableSearchKeyLike,
  clientSearchKeyRangeFrom,
} from "../clientTypes.advanced.js";
import { ClientIndexerSearchKey } from "../clientTypes.js";

export const DEFAULT_CONFIRMED_BLOCK_TIME = numFrom(1000 * 10 * 50); // 50 blocks * 10s

// [isLive, Cell | OutPoint]
export type CellRecord =
  | [
      false,
      Pick<Cell, "outPoint"> & Partial<Pick<Cell, "cellOutput" | "outputData">>,
    ]
  | [true, Cell]
  | [undefined, Cell];

export function filterData(
  dataLike: HexLike,
  filterLike: HexLike | undefined,
  filterMode: "exact" | "prefix" | "partial",
): boolean {
  if (!filterLike) {
    return true;
  }

  const data = hexFrom(dataLike);
  const filter = hexFrom(filterLike);
  if (
    (filterMode === "exact" && data !== filter) ||
    (filterMode === "prefix" && !data.startsWith(filter)) ||
    (filterMode === "partial" && data.search(filter) === -1)
  ) {
    return false;
  }

  return true;
}

export function filterScript(
  valueLike: ScriptLike | undefined,
  filterLike: ScriptLike | undefined,
  filterMode: "prefix" | "exact" | "partial",
): boolean {
  if (!filterLike) {
    return true;
  }
  if (!valueLike) {
    return false;
  }

  const value = Script.from(valueLike);
  const filter = Script.from(filterLike);
  if (
    value.codeHash !== filter.codeHash ||
    value.hashType !== filter.hashType
  ) {
    return false;
  }

  return filterData(value.args, filter?.args, filterMode);
}

export function filterNumByRange(
  lengthLike: NumLike,
  range: [NumLike, NumLike] | undefined,
): boolean {
  if (!range) {
    return true;
  }
  const length = numFrom(lengthLike);
  const [lower, upper] = clientSearchKeyRangeFrom(range);

  return lower <= length && length < upper;
}

export function filterScriptByLenRange(
  valueLike?: ScriptLike,
  scriptLenRange?: [NumLike, NumLike],
): boolean {
  if (!scriptLenRange) {
    return true;
  }

  const len = (() => {
    if (!valueLike) {
      return 0;
    }
    return bytesFrom(Script.from(valueLike).args).length + 33;
  })();
  return filterNumByRange(len, scriptLenRange);
}

export function filterCell(
  searchKeyLike: ClientCollectableSearchKeyLike,
  cellLike: CellLike,
): boolean {
  const key = ClientIndexerSearchKey.from(searchKeyLike);
  const cell = Cell.from(cellLike);

  if (key.scriptType === "lock") {
    if (
      !filterScript(cell.cellOutput.lock, key.script, key.scriptSearchMode) ||
      !filterScript(cell.cellOutput.type, key.filter?.script, "prefix") ||
      !filterScriptByLenRange(cell.cellOutput.type, key.filter?.scriptLenRange)
    ) {
      return false;
    }
  }
  if (key.scriptType === "type") {
    if (
      !filterScript(cell.cellOutput.type, key.script, key.scriptSearchMode) ||
      !filterScript(cell.cellOutput.lock, key.filter?.script, "prefix") ||
      !filterScriptByLenRange(cell.cellOutput.lock, key.filter?.scriptLenRange)
    ) {
      return false;
    }
  }

  if (
    !filterData(
      cell.outputData,
      key.filter?.outputData,
      key.filter?.outputDataSearchMode ?? "prefix",
    ) ||
    !filterNumByRange(
      bytesFrom(cell.outputData).length,
      key.filter?.outputDataLenRange,
    )
  ) {
    return false;
  }

  if (
    !filterNumByRange(cell.cellOutput.capacity, key.filter?.outputCapacityRange)
  ) {
    return false;
  }

  return true;
}

/**
 * A Least Recently Used (LRU) cache implemented using a Map.
 *
 * This class extends the built-in Map to provide an LRU cache with a fixed capacity.
 * When the cache is full, the least recently used entry is automatically evicted.
 *
 * @template K The type of the keys in the cache.
 * @template V The type of the values in the cache.
 */
export class MapLru<K, V> extends Map<K, V> {
  /**
   * Constructs a new MapLru instance.
   *
   * @param capacity The maximum number of entries the cache can hold. Must be a positive integer.
   * @throws {Error} If the capacity is not a positive integer.
   */
  constructor(private readonly capacity: number) {
    super();
    if (!Number.isInteger(capacity) || capacity < 1) {
      throw new Error("Capacity must be a positive integer");
    }
  }

  /**
   * Retrieves a value from the cache.
   *
   * If the key is present in the cache, the value is moved to the most-recently-used position.
   *
   * @param key The key of the value to retrieve.
   * @returns The value associated with the key, or undefined if the key is not present.
   */
  override get(key: K): V | undefined {
    // Check if the key exists. If not, return undefined.
    if (!super.has(key)) {
      return undefined;
    }

    const value = super.get(key) as V;

    // Move to most-recently-used position
    super.delete(key);
    super.set(key, value);

    return value;
  }

  /**
   * Inserts a new value into the cache, or updates an existing value.
   *
   * If the key is already present in the cache, it is first deleted so that the re-insertion
   * moves it to the most-recently-used position.
   * If the cache is over capacity after the insertion, the least recently used entry is evicted.
   *
   * @param key The key of the value to insert or update.
   * @param value The value to associate with the key.
   * @returns This MapLru instance.
   */
  override set(key: K, value: V): this {
    // Delete and re-insert to move key to the end (most-recently-used)
    super.delete(key);
    super.set(key, value);

    // Evict oldest if over capacity
    if (super.size > this.capacity) {
      const oldestKey = super.keys().next().value!;
      super.delete(oldestKey);
    }

    return this;
  }
}
