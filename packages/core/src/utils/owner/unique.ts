import { Owner } from "./owner.js";

/**
 * An Owner with a single, transferable ownership claim.
 *
 * @example
 * ```ts
 * const owner = new OwnerUnique(
 *   new AbortController(),
 *   (controller) => controller.abort(),
 * );
 *
 * const signal = owner.value.signal;
 * await owner.dispose();
 * ```
 *
 * @public
 */
export class OwnerUnique<T> extends Owner<T> {
  constructor(
    protected readonly value_: T,
    private readonly disposer: (value: T) => PromiseLike<void> | void,
  ) {
    super();
  }

  protected release(value: T) {
    return this.disposer(value);
  }
}
