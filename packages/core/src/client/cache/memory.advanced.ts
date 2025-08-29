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
 * A Least Recently Used (LRU) cache implemented by extending the built-in Map.
 *
 * This class preserves all Map behaviors while adding LRU eviction semantics:
 * - When an entry is accessed via get() it becomes the most recently used.
 * - When an entry is inserted via set() it becomes the most recently used.
 * - If insertion causes the cache to exceed its capacity, the least recently used
 *   entry is evicted automatically.
 *
 * Implementation notes:
 * - The Map (super) stores key-value pairs and provides O(1) get/set/delete semantics.
 * - A Set named `lru` maintains usage order: the iteration order of the Set goes from
 *   least-recently-used (first) to most-recently-used (last). We update that Set on
 *   accesses and insertions to keep order correct.
 *
 * @template K Type of keys in the cache.
 * @template V Type of values in the cache.
 */
export class MapLru<K, V> extends Map<K, V> {
  /**
   * Internal ordered set used to track key usage.
   *
   * The Set preserves insertion order; keys are re-inserted on access so that the
   * first element in the Set is always the least recently used key.
   */
  private readonly lru: Set<K> = new Set();

  /**
   * Create a new MapLru with a fixed capacity.
   *
   * The capacity is the maximum number of entries the cache will hold. When the cache
   * grows beyond this capacity the least recently used entry is removed.
   *
   * @param capacity Maximum number of entries allowed in the cache.
   * @throws {Error} If capacity is not a positive integer.
   */
  constructor(private readonly capacity: number) {
    super();
    if (!Number.isInteger(capacity) || capacity < 1) {
      throw new Error("Capacity must be a positive integer");
    }
  }

  /**
   * Retrieve a value from the cache and mark the key as most-recently-used.
   *
   * Behavior details:
   * - If the key is present, it is moved to the most-recently-used position in the
   *   internal LRU tracking Set and its associated value is returned.
   * - If the key is not present, undefined is returned and the LRU order is unchanged.
   *
   * @param key Key whose associated value is to be returned.
   * @returns The value associated with the specified key, or **undefined** if not present.
   */
  override get(key: K): V | undefined {
    // If the Map does not contain the key, return undefined without changing LRU order.
    if (!super.has(key)) {
      return undefined;
    }

    // Move to most-recently-used position by deleting then re-adding the key.
    this.lru.delete(key);
    this.lru.add(key);

    // super.get is safe to cast because we just confirmed the key exists.
    return super.get(key) as V;
  }

  /**
   * Insert or update a key/value pair and mark the key as most-recently-used.
   *
   * Behavior details:
   * - If the key already exists, it's updated and moved to the most-recently-used position.
   * - If insertion causes the cache size to exceed capacity, the least-recently-used key
   *   (the first key in the LRU Set) is evicted from both the Map and the LRU Set.
   *
   * @param key Key to insert or update.
   * @param value Value to associate with the key.
   * @returns This MapLru instance (allows chaining).
   */
  override set(key: K, value: V): this {
    // Store/update the value in the underlying Map.
    super.set(key, value);

    // Ensure key is at the most-recently-used position.
    this.lru.delete(key);
    this.lru.add(key);

    // If over capacity, evict the least-recently-used key (first key in Set iteration).
    if (super.size > this.capacity) {
      // .next().value is guaranteed to exist here because size > capacity >= 1
      const oldestKey = this.lru.keys().next().value!;
      super.delete(oldestKey);
      this.lru.delete(oldestKey);
    }

    return this;
  }

  /**
   * Remove a key and its associated value from the cache.
   *
   * This removes the key from both the underlying Map and the LRU tracking Set.
   *
   * @param key Key to remove.
   * @returns **true** if the key was present and removed; **false** if the key was not present.
   */
  override delete(key: K): boolean {
    // Attempt to delete from the underlying Map first; if it didn't exist, no changes are needed.
    if (!super.delete(key)) {
      return false;
    }
    // Ensure LRU tracking no longer references the deleted key.
    this.lru.delete(key);
    return true;
  }

  /**
   * Remove all entries from the cache.
   *
   * This clears both the underlying Map storage and the internal LRU tracking Set,
   * ensuring no stale keys remain in the LRU structure after the cache is emptied.
   */
  override clear(): void {
    super.clear();
    this.lru.clear();
  }
}
