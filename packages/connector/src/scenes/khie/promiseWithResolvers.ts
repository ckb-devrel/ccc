export async function ensurePromiseWithResolvers(): Promise<void> {
  if (typeof Reflect.get(Promise, "withResolvers") === "function") {
    return;
  }

  await import("core-js/es/promise/with-resolvers.js");
}
