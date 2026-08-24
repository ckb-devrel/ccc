/**
 * An ownership claim moved out of an {@link Owner}.
 *
 * @public
 */
export class OwnerMoved<T> {
  private disposing?: Promise<void>;

  constructor(
    /** The owned value. */
    readonly value: T,
    private readonly disposer: (value: T) => PromiseLike<void> | void,
  ) {}

  /** Disposes this ownership claim. */
  dispose(): Promise<void> {
    this.disposing ??= Promise.resolve().then(() => this.disposer(this.value));
    return this.disposing;
  }
}

/**
 * Owns the lifecycle of a value.
 *
 * @example
 * ```ts
 * class ConnectionOwner extends Owner<Connection> {
 *   constructor(protected readonly value_: Connection) {
 *     super();
 *   }
 *
 *   protected release(connection: Connection): Promise<void> {
 *     return connection.close();
 *   }
 * }
 * ```
 *
 * @public
 */
export abstract class Owner<T> {
  protected abstract readonly value_: T;

  private disposing?: Promise<void>;

  /**
   * The owned value.
   *
   * @throws If this ownership has been moved or disposed.
   */
  get value(): T {
    if (this.disposing) {
      throw new Error("Cannot access a moved or disposed Owner");
    }
    return this.value_;
  }

  /**
   * Releases this ownership claim.
   *
   * Implementations decide whether this disposes the value immediately or,
   * for example, only decrements a reference count.
   */
  protected abstract release(value: T): PromiseLike<void> | void;

  /**
   * Disposes this ownership claim. Repeated calls are safe.
   */
  dispose(): Promise<void> {
    this.disposing ??= Promise.resolve().then(() => this.release(this.value_));
    return this.disposing;
  }

  /**
   * Moves the ownership claim out of this owner without disposing it.
   *
   * Access is invalidated synchronously and the moved claim retains this
   * Owner's release semantics.
   *
   * @throws If this owner no longer has an ownership claim.
   */
  protected move(): OwnerMoved<T> {
    if (this.disposing) {
      throw new Error("Owner has already been moved or disposed");
    }

    this.disposing = Promise.resolve();

    return new OwnerMoved(this.value_, (value) => this.release(value));
  }

  /**
   * Moves an ownership claim between Owner implementations.
   *
   * @throws If the source owner has already been moved or disposed.
   */
  protected static moveFrom<T>(owner: Owner<T>): OwnerMoved<T> {
    return owner.move();
  }
}
