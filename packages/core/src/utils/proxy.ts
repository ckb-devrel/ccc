import type { AbstractConstructor, Constructor } from "./constructor.js";

/**
 * Utilities for creating composition wrappers.
 *
 * @example
 * ```ts
 * class Wrapper extends Proxy.Base(Client) {
 *   static readonly [Proxy.localKeys] = ["feeRate"];
 *   public feeRate = 1000;
 *
 *   request(): void {
 *     this[Proxy.inner].request();
 *   }
 * }
 *
 * const wrapper = new Wrapper(client);
 * ```
 *
 * @public
 */
// eslint-disable-next-line @typescript-eslint/no-namespace
export namespace Proxy {
  /** The property key for accessing the immediately wrapped object. */
  export const inner = "@ckb-ccc/core.Proxy.inner";

  /**
   * The static metadata key for instance fields that belong to the wrapper.
   * Every wrapper instance field must be listed here. Prototype members are
   * detected automatically.
   */
  export const localKeys: unique symbol = Symbol.for(
    "@ckb-ccc/core.Proxy.localKeys",
  );

  /**
   * Creates a wrapper base that delegates non-local members to an inner instance.
   * Its constructor accepts the inner instance and does not invoke `BaseClass`.
   *
   * @remarks
   * Wrapping an abstract class may require suppressing TS2655 because its abstract
   * members are implemented by runtime delegation.
   *
   * @param BaseClass - The class represented by the wrapper.
   */
  export function Base<BaseClass extends AbstractConstructor<object>>(
    BaseClass: BaseClass,
  ): Omit<BaseClass, "prototype"> &
    Constructor<
      InstanceType<BaseClass> & {
        readonly [inner]: InstanceType<BaseClass>;
      },
      [InstanceType<BaseClass>]
    > {
    type T = InstanceType<BaseClass>;

    class ProxyClass {
      public readonly [inner]: T;

      constructor(innerValue: T) {
        this[inner] = innerValue;

        const allLocalKeys = new Set<PropertyKey>([inner]);
        const forwardedFunctions = new Map<
          PropertyKey,
          { value: unknown; wrapper: (...args: unknown[]) => unknown }
        >();

        // Members introduced between the concrete subclass and ProxyClass belong
        // to the wrapper. Stop before ProxyClass so members inherited from Base
        // continue to be forwarded to inner.
        for (
          let prototype: object | null = new.target.prototype;
          prototype !== null && prototype !== ProxyClass.prototype;
          prototype = Reflect.getPrototypeOf(prototype)
        ) {
          // Every member defined directly on this prototype belongs to the wrapper.
          for (const property of Reflect.ownKeys(prototype)) {
            allLocalKeys.add(property);
          }

          // Resolve the class that owns this prototype and merge the local keys
          // declared in its static metadata.
          const constructor = Object.getOwnPropertyDescriptor(
            prototype,
            "constructor",
          )?.value as unknown;

          try {
            const metadataKeys = Object.getOwnPropertyDescriptor(
              constructor,
              localKeys,
            )?.value as readonly PropertyKey[] | undefined;
            for (const property of metadataKeys ?? []) {
              allLocalKeys.add(property);
            }
          } catch {}
        }

        const isLocalProperty = (
          target: object,
          property: PropertyKey,
        ): boolean =>
          allLocalKeys.has(property) ||
          Reflect.getOwnPropertyDescriptor(target, property) !== undefined;

        return new globalThis.Proxy(this, {
          deleteProperty: (target, property) => {
            return Reflect.deleteProperty(
              isLocalProperty(target, property) ? target : innerValue,
              property,
            );
          },
          get: (target, property, receiver) => {
            const isLocal = isLocalProperty(target, property);
            const value = Reflect.get(
              isLocal ? target : innerValue,
              property,
              isLocal ? receiver : innerValue,
            ) as unknown;
            if (isLocal || typeof value !== "function") {
              return value;
            }

            let cached = forwardedFunctions.get(property);
            if (cached?.value !== value) {
              cached = {
                value,
                wrapper: (...args: unknown[]): unknown =>
                  Reflect.apply(value, innerValue, args) as unknown,
              };
              forwardedFunctions.set(property, cached);
            }
            return cached.wrapper;
          },
          has: (target, property) => {
            return Reflect.has(
              isLocalProperty(target, property) ? target : innerValue,
              property,
            );
          },
          set: (target, property, value, receiver) => {
            const isLocal = isLocalProperty(target, property);
            return Reflect.set(
              isLocal ? target : innerValue,
              property,
              value,
              isLocal ? receiver : innerValue,
            );
          },
        });
      }
    }

    // Preserve the runtime instance and static inheritance relationships without
    // constructing a second BaseClass instance as the proxy target.
    const BasePrototype = (BaseClass as unknown as { prototype: object })
      .prototype;
    Object.setPrototypeOf(ProxyClass.prototype, BasePrototype);
    Object.setPrototypeOf(ProxyClass, BaseClass);

    return ProxyClass as unknown as Omit<BaseClass, "prototype"> &
      Constructor<T & { readonly [inner]: T }, [T]>;
  }
}
