import { Owner, OwnerMoved } from "./owner.js";

// TypeScript has no existential type for heterogeneous Owner values.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Owners = readonly Owner<any>[];

type OwnerValues<T extends Owners> = {
  [K in keyof T]: T[K] extends Owner<infer U> ? U : never;
};

/**
 * An Owner that aggregates multiple ownership claims.
 *
 * Disposing it attempts to release every claim and aggregates any failures.
 *
 * @public
 */
export class OwnerAggregated<T extends readonly unknown[]> extends Owner<T> {
  private constructor(
    protected readonly value_: T,
    private readonly owners: readonly OwnerMoved<unknown>[],
  ) {
    super();
  }

  /** Moves multiple ownership claims into one Owner. */
  static from<const TOwners extends Owners>(
    owners: TOwners,
  ): OwnerAggregated<OwnerValues<TOwners>> {
    if (new Set(owners).size !== owners.length) {
      throw new Error("Cannot aggregate the same Owner more than once");
    }

    // Validate every source before moving any of them.
    const values = owners.map(
      (owner): unknown => owner.value,
    ) as OwnerValues<TOwners>;
    const moved = owners.map((owner) => this.moveFrom(owner));
    return new OwnerAggregated(values, moved);
  }

  protected async release(): Promise<void> {
    const results = await Promise.allSettled(
      this.owners.map((owner) => owner.dispose()),
    );
    const errors: unknown[] = [];
    for (const result of results) {
      if (result.status === "rejected") {
        errors.push(result.reason as unknown);
      }
    }
    if (errors.length !== 0) {
      throw new AggregateError(errors, "Failed to dispose aggregated Owners");
    }
  }
}
