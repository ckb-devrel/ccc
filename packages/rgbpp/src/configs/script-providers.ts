import { ccc } from "@ckb-ccc/core";

import { IScriptProvider } from "../types/script.js";

/**
 * ClientScriptProvider - Fetches script info from CKB client with caching
 *
 * @example
 * ```typescript
 * const provider = new ClientScriptProvider(client);
 * const scriptInfo = await provider.getScriptInfo(ccc.KnownScript.RgbppLock);
 * ```
 */
export class ClientScriptProvider implements IScriptProvider {
  private cache = new Map<ccc.KnownScript, Promise<ccc.ScriptInfo>>();

  constructor(private client: ccc.Client) {}

  async getScriptInfo(name: ccc.KnownScript): Promise<ccc.ScriptInfo> {
    let promise = this.cache.get(name);
    if (!promise) {
      promise = this.client.getKnownScript(name);
      this.cache.set(name, promise);
    }
    return promise;
  }

  /**
   * Clear the internal cache
   */
  clearCache(): void {
    this.cache.clear();
  }
}

/**
 * StaticScriptProvider - Uses predefined script configurations
 *
 * @example
 * ```typescript
 * const provider = new StaticScriptProvider({
 *   [ccc.KnownScript.RgbppLock]: ccc.ScriptInfo.from({
 *     codeHash: "0x...",
 *     hashType: "type",
 *     cellDeps: [{ outPoint: { txHash: "0x...", index: 0 }, depType: "code" }]
 *   })
 * });
 * ```
 */
export class StaticScriptProvider implements IScriptProvider {
  private scripts: Map<ccc.KnownScript, ccc.ScriptInfo>;

  constructor(scripts: Partial<Record<ccc.KnownScript, ccc.ScriptInfo>>) {
    this.scripts = new Map(Object.entries(scripts)) as Map<
      ccc.KnownScript,
      ccc.ScriptInfo
    >;
  }

  async getScriptInfo(name: ccc.KnownScript): Promise<ccc.ScriptInfo> {
    const info = this.scripts.get(name);
    if (!info) {
      throw new Error(`Script not found: ${name}`);
    }
    return info;
  }
}

/**
 * CompositeScriptProvider - Tries multiple providers in order until one succeeds
 *
 * **Priority**: Providers are tried in array order - the first provider has the highest priority.
 * If a provider throws an error, the next provider is tried. This enables fallback strategies.
 *
 * Common use cases:
 * - **Custom scripts with fallback**: Try user-defined scripts first, then fall back to client
 * - **Multi-source**: Support multiple script sources with priority
 * - **Override**: Override specific scripts while keeping others from the default source
 *
 * @example
 * ```typescript
 * // Priority: Custom scripts (highest) → Client (fallback)
 * const provider = new CompositeScriptProvider([
 *   new StaticScriptProvider(customScripts),  // Tried first
 *   new ClientScriptProvider(client),         // Tried if custom fails
 * ]);
 *
 * // Priority: TestNet → MainNet (for testing with mainnet fallback)
 * const provider = new CompositeScriptProvider([
 *   new ClientScriptProvider(testnetClient),  // Tried first
 *   new ClientScriptProvider(mainnetClient),  // Fallback
 * ]);
 * ```
 */
export class CompositeScriptProvider implements IScriptProvider {
  /**
   * @param providers - Array of providers in priority order (first = highest priority)
   */
  constructor(private providers: IScriptProvider[]) {
    if (providers.length === 0) {
      throw new Error("CompositeScriptProvider requires at least one provider");
    }
  }

  async getScriptInfo(name: ccc.KnownScript): Promise<ccc.ScriptInfo> {
    const errors: Error[] = [];

    for (const provider of this.providers) {
      try {
        return await provider.getScriptInfo(name);
      } catch (error) {
        errors.push(error as Error);
        // Continue to next provider
      }
    }

    // All providers failed
    throw new Error(
      `Failed to get script "${name}" from all providers:\n${errors.map((e, i) => `  [${i + 1}] ${e.message}`).join("\n")}`,
    );
  }

  /**
   * Add a high-priority provider (inserted at the beginning)
   * Useful for adding override scripts without recreating the provider chain
   *
   * @example
   * ```typescript
   * const baseProvider = createScriptProvider(client);
   * const withOverrides = baseProvider.withHighPriority(
   *   new StaticScriptProvider(overrideScripts)
   * );
   * ```
   */
  withHighPriority(provider: IScriptProvider): CompositeScriptProvider {
    return new CompositeScriptProvider([provider, ...this.providers]);
  }

  /**
   * Add a low-priority provider (appended at the end)
   * Useful for adding fallback scripts
   *
   * @example
   * ```typescript
   * const provider = createScriptProvider(client);
   * const withFallback = provider.withFallback(
   *   new StaticScriptProvider(fallbackScripts)
   * );
   * ```
   */
  withFallback(provider: IScriptProvider): CompositeScriptProvider {
    return new CompositeScriptProvider([...this.providers, provider]);
  }

  /**
   * Create a composite provider with custom scripts having highest priority
   *
   * @example
   * ```typescript
   * const provider = CompositeScriptProvider.withCustomScripts(
   *   client,
   *   customScripts
   * );
   * ```
   */
  static withCustomScripts(
    client: ccc.Client,
    customScripts: Partial<Record<ccc.KnownScript, ccc.ScriptInfo>>,
  ): CompositeScriptProvider {
    return new CompositeScriptProvider([
      new StaticScriptProvider(customScripts),
      new ClientScriptProvider(client),
    ]);
  }
}

/**
 * Factory function to create a script provider with common patterns
 *
 * **Priority when custom scripts provided:**
 * 1. Custom scripts (highest priority) - user-defined configurations
 * 2. Client scripts (fallback) - fetched from CKB node
 *
 * This ensures your custom scripts always take precedence, with automatic fallback
 * to the client for any scripts not defined in your custom configuration.
 *
 * @param client - CKB client instance
 * @param customScripts - Optional custom script configurations (highest priority)
 * @returns A script provider (composite if custom scripts provided, otherwise client-based)
 *
 * @example
 * ```typescript
 * // Without custom scripts - uses client only
 * const provider = createScriptProvider(client);
 *
 * // With custom scripts - custom scripts have highest priority
 * const provider = createScriptProvider(client, {
 *   [ccc.KnownScript.RgbppLock]: myCustomRgbppScript,  // This will be used
 * });
 * // When requesting RgbppLock: returns myCustomRgbppScript
 * // When requesting other scripts: falls back to client
 *
 * // Override specific scripts for testing
 * const testProvider = createScriptProvider(client, {
 *   [ccc.KnownScript.RgbppLock]: testRgbppScript,  // Override for testing
 *   // Other scripts will use client defaults
 * });
 * ```
 */
export function createScriptProvider(
  client: ccc.Client,
  customScripts?: Partial<Record<ccc.KnownScript, ccc.ScriptInfo>>,
): IScriptProvider {
  if (!customScripts || Object.keys(customScripts).length === 0) {
    return new ClientScriptProvider(client);
  }

  // Priority: Custom scripts (1st) → Client scripts (2nd)
  return new CompositeScriptProvider([
    new StaticScriptProvider(customScripts),
    new ClientScriptProvider(client),
  ]);
}
