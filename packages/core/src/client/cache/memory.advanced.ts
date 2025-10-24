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
 * A Map-like class that implements a "Least Recently Used" (LRU) cache policy.
 * When the cache reaches its capacity, the least recently used item is removed.
 * @public
 */
export class MapLru<K, V> extends Map<K, V> {
  private readonly lru: Set<K> = new Set<K>();

  /**
   * @param capacity - The maximum number of items to store in the cache. Must be a positive integer.
   */
  constructor(private readonly capacity: number) {
    super();

    if (!Number.isInteger(capacity) || capacity < 1) {
      throw new Error("Capacity must be a positive integer");
    }
  }

  /**
   * Retrieves the value for a given key and marks it as recently used.
   * @param key - The key of the element to retrieve.
   * @returns The value associated with the key, or `undefined` if the key is not in the cache.
   */
  override get(key: K) {
    if (!super.has(key)) {
      return;
    }

    this.lru.delete(key);
    this.lru.add(key);

    return super.get(key);
  }

  /**
   * Adds or updates a key-value pair in the cache and marks the key as recently used.
   * If setting a new key causes the cache to exceed its capacity, the least recently used item is evicted.
   * @param key - The key of the element to add or update.
   * @param value - The value of the element to add or update.
   * @returns The `MapLru` instance.
   */
  override set(key: K, value: V) {
    super.set(key, value);

    this.lru.delete(key);
    this.lru.add(key);

    // Evict the oldest entry if capacity is exceeded.
    if (this.lru.size > this.capacity) {
      const oldestKey = this.lru.keys().next().value!;
      this.delete(oldestKey);
    }
    return this;
  }

  /**
   * Removes the specified element from the cache.
   * @param key - The key of the element to remove.
   * @returns `true` if an element in the `MapLru` object existed and has been removed, or `false` if the element does not exist.
   */
  override delete(key: K): boolean {
    if (!super.delete(key)) {
      return false;
    }

    this.lru.delete(key);
    return true;
  }

  /**
   * Removes all key-value pairs from the cache.
   */
  override clear() {
    super.clear();
    this.lru.clear();
  }
}
