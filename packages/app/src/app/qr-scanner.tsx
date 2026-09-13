"use client";

import type { QRCamera, QRCanvas } from "qr/dom.js";
import { useEffect, useEffectEvent, useRef } from "react";

const SCAN_INTERVAL_MS = 100;

export type QrScannerProps = {
  ariaLabel?: string;
  className?: string;
  onError: (error: unknown) => void;
  onScan: (value: string) => void;
};

export function QrScanner({
  ariaLabel = "QR code scanner",
  className,
  onError,
  onScan,
}: QrScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const onErrorCurrent = useEffectEvent(onError);
  const onScanCurrent = useEffectEvent(onScan);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) {
      return;
    }

    let stopped = false;
    let camera: QRCamera | undefined;
    let stopScanLoop = () => {};
    const stop = () => {
      if (stopped) {
        return;
      }

      stopped = true;
      stopScanLoop();
      camera?.stop();
      video.srcObject = null;
    };

    const start = async () => {
      try {
        assertCameraAvailable();
        const { QRCanvas, rearCamera } = await import("qr/dom.js");
        if (stopped) {
          return;
        }

        camera = await rearCamera(video);
        if (stopped) {
          camera.stop();
          video.srcObject = null;
          return;
        }

        await video.play();
        if (stopped) {
          return;
        }

        stopScanLoop = startScanning(
          video,
          camera,
          new QRCanvas(),
          (value) => {
            stop();
            onScanCurrent(value);
          },
          (error) => {
            stop();
            onErrorCurrent(error);
          },
        );
      } catch (error) {
        if (!stopped) {
          stop();
          onErrorCurrent(error);
        }
      }
    };

    void start();
    return stop;
  }, []);

  return (
    <video
      ref={videoRef}
      className={className}
      aria-label={ariaLabel}
      autoPlay
      muted
      playsInline
    />
  );
}

function assertCameraAvailable() {
  if (!window.isSecureContext) {
    throw new Error("Camera access requires HTTPS or localhost");
  }
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error("Camera access is not supported by this browser");
  }
}

function startScanning(
  video: HTMLVideoElement,
  camera: QRCamera,
  canvas: QRCanvas,
  onScan: (value: string) => void,
  onError: (error: unknown) => void,
) {
  let timeout: ReturnType<typeof setTimeout>;
  let stopped = false;

  const scheduleScan = () => {
    timeout = setTimeout(() => void scan(), SCAN_INTERVAL_MS);
  };

  async function scan() {
    if (stopped) {
      return;
    }

    if (video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
      scheduleScan();
      return;
    }

    try {
      const value = await camera.readFrame(canvas, true);
      if (stopped) {
        return;
      }
      if (typeof value === "string") {
        onScan(value);
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
  return () => {
    stopped = true;
    clearTimeout(timeout);
  };
}
