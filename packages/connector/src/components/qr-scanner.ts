import { css, html, LitElement } from "lit";
import { customElement, query } from "lit/decorators.js";
import type { QRCanvas } from "qr/dom.js";

const SCAN_INTERVAL_MS = 100;

interface QrCamera {
  readFrame(canvas: QRCanvas, fullSize?: boolean): string | undefined;
  stop(): void;
}

function assertCameraAvailable() {
  if (!window.isSecureContext) {
    throw new Error("Camera access requires HTTPS or localhost");
  }
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error("Camera access is not supported by this browser");
  }
}

function startScanLoop(
  video: HTMLVideoElement,
  camera: QrCamera,
  canvas: QRCanvas,
  onScanned: (value: string) => void,
  onError: (error: unknown) => void,
) {
  let timeout: ReturnType<typeof setTimeout>;

  const scanFrame = () => {
    // Wait until the video has a frame that can be decoded.
    if (video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
      timeout = setTimeout(scanFrame, SCAN_INTERVAL_MS);
      return;
    }

    try {
      // Decode the full camera frame so QR codes near the preview edge still work.
      const value = camera.readFrame(canvas, true);
      if (value) {
        onScanned(value);
        return;
      }
    } catch (error) {
      onError(error);
      return;
    }

    timeout = setTimeout(scanFrame, SCAN_INTERVAL_MS);
  };

  timeout = setTimeout(scanFrame, SCAN_INTERVAL_MS);
  // The caller owns the loop lifetime together with the camera session.
  return () => clearTimeout(timeout);
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
      this.fail(new Error("Camera preview is not available"));
      return;
    }

    let camera: QrCamera | undefined;
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

      const { QRCanvas, frontalCamera } = await import("qr/dom.js");
      if (!isCurrent()) {
        return;
      }

      camera = await frontalCamera(video);
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
        new QRCanvas(),
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
