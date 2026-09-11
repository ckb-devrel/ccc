"use client";

import type { QRCanvas } from "qr/dom.js";
import { useEffect, useEffectEvent, useRef } from "react";

const SCAN_INTERVAL_MS = 100;

interface QrCamera {
  readFrame(canvas: QRCanvas, fullSize?: boolean): string | undefined;
  stop(): void;
}

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
    let camera: QrCamera | undefined;
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
        const { QRCanvas, frontalCamera } = await import("qr/dom.js");
        if (stopped) {
          return;
        }

        camera = await frontalCamera(video);
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
  camera: QrCamera,
  canvas: QRCanvas,
  onScan: (value: string) => void,
  onError: (error: unknown) => void,
) {
  let timeout: ReturnType<typeof setTimeout>;
  const scan = () => {
    if (video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
      timeout = setTimeout(scan, SCAN_INTERVAL_MS);
      return;
    }

    try {
      const value = camera.readFrame(canvas, true);
      if (value) {
        onScan(value);
        return;
      }
    } catch (error) {
      onError(error);
      return;
    }

    timeout = setTimeout(scan, SCAN_INTERVAL_MS);
  };

  timeout = setTimeout(scan, SCAN_INTERVAL_MS);
  return () => clearTimeout(timeout);
}
