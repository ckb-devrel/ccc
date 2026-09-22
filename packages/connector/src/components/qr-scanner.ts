import { css, html, LitElement } from "lit";
import { customElement, query } from "lit/decorators.js";
import type { QRCamera, QRCanvas } from "qr/dom.js";
import { ConnectorError } from "../scenes/error.js";

const SCAN_INTERVAL_MS = 100;

type BarcodeDetectorLike = {
  detect(source: CanvasImageSource): Promise<readonly { rawValue: string }[]>;
};

type BarcodeDetectorConstructor = {
  new (options: { formats: string[] }): BarcodeDetectorLike;
  getSupportedFormats?: () => Promise<string[]>;
};

export async function createBarcodeDetector(): Promise<
  BarcodeDetectorLike | undefined
> {
  const BarcodeDetector = Reflect.get(globalThis, "BarcodeDetector") as
    BarcodeDetectorConstructor | undefined;
  if (typeof BarcodeDetector !== "function") {
    return;
  }

  try {
    const formats = await BarcodeDetector.getSupportedFormats?.();
    if (formats && !formats.includes("qr_code")) {
      return;
    }
    return new BarcodeDetector({ formats: ["qr_code"] });
  } catch {
    return;
  }
}

function assertCameraAvailable() {
  if (!window.isSecureContext) {
    throw new ConnectorError(
      "camera-https-required",
      "Camera access requires HTTPS or localhost",
    );
  }
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new ConnectorError(
      "camera-not-supported",
      "Camera access is not supported by this browser",
    );
  }
}

export function startScanLoop(
  video: HTMLVideoElement,
  camera: QRCamera,
  createCanvas: () => QRCanvas,
  barcodeDetector: BarcodeDetectorLike | undefined,
  onScanned: (value: string) => void,
  onError: (error: unknown) => void,
) {
  let timeout: ReturnType<typeof setTimeout>;
  let stopped = false;
  let canvas: QRCanvas | undefined;

  const scheduleScan = () => {
    timeout = setTimeout(() => void scanFrame(), SCAN_INTERVAL_MS);
  };

  async function scanFrame() {
    if (stopped) {
      return;
    }

    // Wait until the video has a frame that can be decoded.
    if (video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
      scheduleScan();
      return;
    }

    try {
      let value: unknown;
      if (barcodeDetector) {
        try {
          value = (await barcodeDetector.detect(video))[0]?.rawValue;
        } catch {
          if (stopped) {
            return;
          }
          // Fall back if the browser exposes an unusable native implementation.
          barcodeDetector = undefined;
        }
      }
      if (!barcodeDetector) {
        // Decode the full camera frame so QR codes near the preview edge still work.
        value = await camera.readFrame((canvas ??= createCanvas()), true);
      }
      if (stopped) {
        return;
      }
      if (typeof value === "string") {
        onScanned(value);
        return;
      }
    } catch (error) {
      if (!stopped) {
        onError(error);
      }
      return;
    }

    scheduleScan();
  }

  scheduleScan();
  // The caller owns the loop lifetime together with the camera session.
  return () => {
    stopped = true;
    clearTimeout(timeout);
  };
}

export class QrScannedEvent extends Event {
  constructor(public readonly value: string) {
    super("qr-scanned", { bubbles: true, composed: true });
  }
}

@customElement("ccc-qr-scanner")
export class QrScanner extends LitElement {
  @query("video")
  private video?: HTMLVideoElement;

  private cleanup?: () => void;

  protected firstUpdated() {
    void this.start();
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.stop();
  }

  public stop() {
    const cleanup = this.cleanup;
    this.cleanup = undefined;
    cleanup?.();
  }

  private async start() {
    const video = this.video;
    if (!video) {
      this.fail(
        new ConnectorError(
          "camera-preview-unavailable",
          "Camera preview is not available",
        ),
      );
      return;
    }

    let camera: QRCamera | undefined;
    let stopScanLoop = () => {};
    const cleanup = () => {
      stopScanLoop();
      camera?.stop();
      video.srcObject = null;
    };
    const isCurrent = () => this.isConnected && this.cleanup === cleanup;
    this.cleanup = cleanup;

    try {
      assertCameraAvailable();

      const [{ QRCanvas, rearCamera }, barcodeDetector] = await Promise.all([
        import("qr/dom.js"),
        createBarcodeDetector(),
      ]);
      if (!isCurrent()) {
        return;
      }

      camera = await rearCamera(video);
      // Camera permission may resolve after the scanner is removed.
      if (!isCurrent()) {
        camera.stop();
        video.srcObject = null;
        return;
      }

      await video.play();
      // The scanner may be stopped while playback is starting.
      if (!isCurrent()) {
        return;
      }

      stopScanLoop = startScanLoop(
        video,
        camera,
        () => new QRCanvas(),
        barcodeDetector,
        (value) => {
          this.stop();
          this.dispatchEvent(new QrScannedEvent(value));
        },
        (error) => this.fail(error),
      );
    } catch (error) {
      if (isCurrent()) {
        this.fail(error);
      }
    }
  }

  private fail(error: unknown) {
    this.stop();
    this.dispatchEvent(
      new ErrorEvent("error", { error, bubbles: true, composed: true }),
    );
  }

  render() {
    return html`<video autoplay muted playsinline></video>`;
  }

  static styles = css`
    :host {
      display: grid;
      width: min(28rem, 100%);
      margin: 0 auto;
      place-items: center;
    }

    video {
      display: block;
      width: min(100%, 18rem);
      aspect-ratio: 1;
      border-radius: 0.5rem;
      background: var(--btn-primary);
      object-fit: cover;
      object-position: center;
    }
  `;
}
