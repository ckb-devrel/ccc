/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
import {
  AuthResponseData,
  DappRequestType,
  EvmWeb2LoginResponse,
  PopupCancelledError,
  PopupConfigOptions,
  PopupNotSupportedError,
  PopupTimeoutError,
  SignCkbTxResponseData,
  SignCotaNFTResponseData,
  SignEvmTxResponseData,
  SignMessageResponseData,
  SignNostrEventData,
  createBlockDialog,
  isStandaloneBrowser,
  openPopup,
} from "@joyid/common";

/**
 * Interface representing the return type for various Dapp request types.
 */
export interface PopupReturnType {
  [DappRequestType.Auth]: AuthResponseData;
  [DappRequestType.SignMessage]: SignMessageResponseData;
  [DappRequestType.SignEvm]: SignEvmTxResponseData;
  [DappRequestType.SignPsbt]: SignEvmTxResponseData;
  [DappRequestType.BatchSignPsbt]: {
    psbts: string[];
  };
  [DappRequestType.SignCkbTx]: SignCkbTxResponseData;
  [DappRequestType.SignCotaNFT]: SignCotaNFTResponseData;
  [DappRequestType.SignCkbRawTx]: SignCkbTxResponseData;
  [DappRequestType.SignNostrEvent]: SignNostrEventData;
  [DappRequestType.EncryptNostrMessage]: unknown;
  [DappRequestType.DecryptNostrMessage]: unknown;
  [DappRequestType.AuthMiniApp]: unknown;
  [DappRequestType.SignMiniAppEvm]: unknown;
  [DappRequestType.SignMiniAppMessage]: unknown;
  [DappRequestType.EvmWeb2Login]: EvmWeb2LoginResponse;
}

/**
 * Creates a popup window for JoyID Dapp requests.
 * @param url - The URL to open in the popup.
 * @param config - The popup configuration options.
 * @returns A promise that resolves to the response data of the requested type.
 * @throws {PopupNotSupportedError} If popups are not supported in the current browser.
 * @throws {PopupCancelledError} If the popup is closed by the user.
 * @throws {PopupTimeoutError} If the popup operation times out.
 */
export async function createPopup<T extends DappRequestType>(
  url: string,
  config: PopupConfigOptions<T> & { joyidAppURL: string },
): Promise<PopupReturnType[T]> {
  if (config.popup == null) {
    config.popup = openPopup("");

    if (config.popup == null) {
      return createBlockDialog(async () => createPopup(url, config));
    }
  }

  config.popup.location.href = url;

  return new Promise((resolve, reject) => {
    if (isStandaloneBrowser()) {
      reject(new PopupNotSupportedError(config.popup));
    }
    let popupEventListener: (e: MessageEvent) => void;
    let timeoutId: undefined | ReturnType<typeof setTimeout>;
    // Check each second if the popup is closed triggering a PopupCancelledError
    const popupTimer = setInterval(() => {
      if (config.popup?.closed) {
        clearInterval(popupTimer);
        clearTimeout(timeoutId);
        window.removeEventListener("message", popupEventListener, false);
        reject(new PopupCancelledError(config.popup));
      }
    }, 1000);

    timeoutId = setTimeout(
      () => {
        clearInterval(popupTimer);
        reject(new PopupTimeoutError(config.popup));
        window.removeEventListener("message", popupEventListener, false);
      },
      (config.timeoutInSeconds ?? 3000) * 1000,
    );

    popupEventListener = (e: MessageEvent) => {
      const { joyidAppURL } = config;
      const appURL = new URL(joyidAppURL);
      if (e.origin !== appURL.origin) {
        return;
      }
      if (!e.data || e.data?.type !== config.type) {
        return;
      }

      clearTimeout(timeoutId);
      clearInterval(popupTimer);
      window.removeEventListener("message", popupEventListener, false);
      config.popup.close();
      if (e.data.error) {
        reject(new Error(e.data.error));
      }
      resolve(e.data.data);
    };

    window.addEventListener("message", popupEventListener);
  });
}
