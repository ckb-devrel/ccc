import { describe, expect, it } from "vitest";
import { Proxy } from "./proxy.js";

class Base {
  static describe(): string {
    return "Base";
  }

  readonly #secret: string;
  public value: number;

  constructor(value: number, secret = "secret") {
    this.value = value;
    this.#secret = secret;
  }

  get secret(): string {
    return this.#secret;
  }

  increment(step = 1): number {
    this.value += step;
    return this.value;
  }
}

describe("Proxy", () => {
  it("forwards inherited properties and accessors to inner", () => {
    class Wrapper extends Proxy.Base(Base) {}

    const inner = new Base(1);
    const wrapper = new Wrapper(inner);

    expect(wrapper[Proxy.inner]).toBe(inner);
    expect(wrapper.value).toBe(1);
    expect("value" in wrapper).toBe(true);
    expect(wrapper.secret).toBe("secret");

    wrapper.value = 2;
    expect(inner.value).toBe(2);
  });

  it("forwards deletion of non-local properties", () => {
    class Wrapper extends Proxy.Base(Base) {
      static readonly [Proxy.localKeys] = ["local"];
      public local = "wrapper";
    }

    const inner = Object.assign(new Base(1), { local: "inner" });
    const wrapper = new Wrapper(inner);

    expect(Reflect.deleteProperty(wrapper, "value")).toBe(true);
    expect(Object.hasOwn(inner, "value")).toBe(false);
    expect(wrapper.value).toBeUndefined();

    expect(Reflect.deleteProperty(wrapper, "local")).toBe(true);
    expect(inner.local).toBe("inner");
    expect(wrapper.local).toBeUndefined();
  });

  it("keeps declared fields and prototype members on each wrapper level", () => {
    class FirstWrapper extends Proxy.Base(Base) {
      static readonly [Proxy.localKeys] = ["first"];
      public first = "first";

      getFirst(): string {
        return this.first;
      }
    }

    class SecondWrapper extends FirstWrapper {
      static readonly [Proxy.localKeys] = ["second"];
      public second = "second";

      getSecond(): string {
        return this.second;
      }
    }

    const inner = Object.assign(new Base(1), {
      first: "inner-first",
      second: "inner-second",
    });
    const wrapper = new SecondWrapper(inner);

    expect(wrapper.first).toBe("first");
    expect(wrapper.second).toBe("second");
    expect(wrapper.getFirst()).toBe("first");
    expect(wrapper.getSecond()).toBe("second");
    expect(inner.first).toBe("inner-first");
    expect(inner.second).toBe("inner-second");
    expect(wrapper.constructor).toBe(SecondWrapper);
    expect(wrapper).toBeInstanceOf(Base);

    Object.defineProperty(wrapper, "first", {
      configurable: true,
      value: "updated",
      writable: true,
    });
    expect(wrapper.first).toBe("updated");
    expect(inner.first).toBe("inner-first");
  });

  it("resolves local accessors through the proxy", () => {
    class Wrapper extends Proxy.Base(Base) {
      get doubled(): number {
        return this.value * 2;
      }

      set doubled(value: number) {
        this.value = value / 2;
      }
    }

    const inner = new Base(3);
    const wrapper = new Wrapper(inner);

    expect(wrapper.doubled).toBe(6);

    wrapper.doubled = 20;
    expect(inner.value).toBe(10);
    expect(wrapper.value).toBe(10);
  });

  it("preserves the base class type and runtime inheritance", () => {
    class Wrapper extends Proxy.Base(Base) {}

    const wrapper = new Wrapper(new Base(1));
    const base: Base = wrapper;

    expect(base).toBe(wrapper);
    expect(wrapper).toBeInstanceOf(Base);
    expect(Wrapper.describe()).toBe("Base");
  });

  it("does not construct a second base instance for the proxy target", () => {
    let constructorCalls = 0;

    class CountingBase {
      constructor() {
        constructorCalls += 1;
      }
    }

    class Wrapper extends Proxy.Base(CountingBase) {}

    const inner = new CountingBase();
    const wrapper = new Wrapper(inner);

    expect(constructorCalls).toBe(1);
    expect(wrapper).toBeInstanceOf(CountingBase);
  });

  it("binds and caches forwarded functions", () => {
    class Wrapper extends Proxy.Base(Base) {}

    const inner = new Base(1);
    const wrapper = new Wrapper(inner);
    const getIncrement = (): Base["increment"] =>
      Reflect.get(wrapper, "increment");
    const increment = getIncrement();

    expect(getIncrement()).toBe(increment);
    expect(increment.call(new Base(100), 2)).toBe(3);
    expect(inner.value).toBe(3);

    inner.increment = function (step = 1): number {
      this.value += step * 2;
      return this.value;
    };

    expect(getIncrement()).not.toBe(increment);
    expect(wrapper.increment(2)).toBe(7);
  });

  it("does not add cached functions to the wrapper own keys", () => {
    class Wrapper extends Proxy.Base(Base) {}

    const wrapper = new Wrapper(new Base(1));
    const ownKeys = Reflect.ownKeys(wrapper);

    void wrapper.increment;
    expect(Reflect.ownKeys(wrapper)).toEqual(ownKeys);
  });

  it("forwards abstract members at runtime", () => {
    abstract class AbstractBase {
      abstract getValue(): number;
    }

    class Inner extends AbstractBase {
      getValue(): number {
        return 42;
      }
    }

    // @ts-expect-error TS2655: Proxy implements abstract members by forwarding them to inner.
    class Wrapper extends Proxy.Base(AbstractBase) {}

    expect(new Wrapper(new Inner()).getValue()).toBe(42);
  });

  it("forwards non-configurable inner properties without violating invariants", () => {
    class LockedBase {
      declare public readonly locked: string;

      constructor(value: string) {
        Object.defineProperty(this, "locked", {
          configurable: false,
          enumerable: true,
          value,
          writable: false,
        });
      }
    }

    class Wrapper extends Proxy.Base(LockedBase) {}

    const inner = new LockedBase("inner");
    const wrapper = new Wrapper(inner);

    expect(wrapper.locked).toBe("inner");
    expect(Reflect.set(wrapper, "locked", "updated")).toBe(false);
    expect(Reflect.deleteProperty(wrapper, "locked")).toBe(false);
    expect(wrapper.locked).toBe("inner");
  });

  it("keeps existing wrapper-owned properties on the proxy target", () => {
    class Wrapper extends Proxy.Base(Base) {}

    const inner = Object.assign(new Base(1), { locked: "inner" });
    const wrapper = new Wrapper(inner);
    Object.defineProperty(wrapper, "locked", {
      configurable: false,
      value: "wrapper",
      writable: false,
    });

    expect(Reflect.get(wrapper, "locked")).toBe("wrapper");
    expect(Reflect.set(wrapper, "locked", "updated")).toBe(false);
    expect(Reflect.deleteProperty(wrapper, "locked")).toBe(false);
    expect(inner.locked).toBe("inner");
  });

  it("uses stable protocol keys", () => {
    expect(Proxy.inner).toBe("@ckb-ccc/core.Proxy.inner");
    expect(Proxy.localKeys).toBe(Symbol.for("@ckb-ccc/core.Proxy.localKeys"));
  });
});
