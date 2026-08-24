import { Owner, OwnerMoved } from "./owner.js";

type OwnerRefCountState<T> = {
  owner: OwnerMoved<T>;
  referenceCount: number;
};

/**
 * A reference-counted Owner for a shared value.
 *
 * The source ownership is disposed after the final OwnerRefCount is disposed.
 * Each clone owns one reference and can be disposed independently.
 *
 * @example
 * ```ts
 * const controller = new AbortController();
 * const first = OwnerRefCount.new(
 *   controller,
 *   (controller) => controller.abort(),
 * );
 * const second = first.clone();
 *
 * await first.dispose();
 * console.log(controller.signal.aborted); // false
 *
 * await second.dispose();
 * console.log(controller.signal.aborted); // true
 * ```
 *
 * @public
 */
export class OwnerRefCount<T> extends Owner<T> {
  private constructor(private readonly state: OwnerRefCountState<T>) {
    super();
  }

  protected get value_(): T {
    return this.state.owner.value;
  }

  /** Creates the first reference-counted Owner for a value. */
  static new<T>(
    value: T,
    disposer: (value: T) => PromiseLike<void> | void,
  ): OwnerRefCount<T> {
    return new OwnerRefCount({
      owner: new OwnerMoved(value, disposer),
      referenceCount: 1,
    });
  }

  /**
   * Moves an ownership claim into a new reference-counted Owner.
   *
   * @throws If the source Owner has already been moved or disposed.
   */
  static from<T>(owner: Owner<T>): OwnerRefCount<T> {
    return new OwnerRefCount({
      owner: this.moveFrom(owner),
      referenceCount: 1,
    });
  }

  /** Creates another Owner for the same shared value. */
  clone(): OwnerRefCount<T> {
    // Assert that this Owner is still active before adding a reference.
    void this.value;
    this.state.referenceCount += 1;
    return new OwnerRefCount(this.state);
  }

  protected release(): Promise<void> | void {
    this.state.referenceCount -= 1;
    if (this.state.referenceCount === 0) {
      return this.state.owner.dispose();
    }
  }
}
