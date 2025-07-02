import { Nip07A } from "@ckb-ccc/nip07/advanced";
import { UniSatA } from "@ckb-ccc/uni-sat/advanced";

export interface BitcoinProvider
  extends Pick<
      UniSatA.Provider,
      "on" | "removeListener" | "signMessage" | "signPsbt" | "pushPsbt"
    >,
    Partial<
      Omit<
        UniSatA.Provider,
        | "on"
        | "removeListener"
        | "signMessage"
        | "signPsbt"
        | "pushPsbt"
        | "pushTx"
      >
    > {
  connect?(): Promise<{
    address: string;
    publicKey: string;
    compressedPublicKey: string;
  }>;

  getSelectedAccount?(): Promise<{
    address: string;
    publicKey: string;
    compressedPublicKey: string;
  } | null>;
}

export interface NostrProvider extends Nip07A.Provider {
  connect?(): Promise<void>;

  /**
   * Adds an event listener to the provider.
   */
  on: NostrOnMethod;

  /**
   * Removes an event listener from the provider.
   * @param eventName - The name of the event to remove the listener from.
   * @param listener - The listener function to remove.
   * @returns The provider instance.
   */
  removeListener(
    eventName: string,
    listener: (...args: unknown[]) => unknown,
  ): NostrProvider;
}

/**
 * Interface representing a method to add event listeners to the provider.
 */
export interface NostrOnMethod {
  /**
   * Adds an event listener to the provider.
   * @param eventName - The name of the event.
   * @param listener - The listener function.
   */
  (eventName: string, listener: (...args: unknown[]) => unknown): void;
}
