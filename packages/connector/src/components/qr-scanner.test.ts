import type { QRCamera, QRCanvas } from "qr/dom.js";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createBarcodeDetector, startScanLoop } from "./qr-scanner.js";

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("createBarcodeDetector", () => {
  it("creates a detector limited to QR codes when supported", async () => {
    const options: unknown[] = [];
    class BarcodeDetector {
      static getSupportedFormats = vi.fn().mockResolvedValue(["qr_code"]);

      constructor(value: unknown) {
        options.push(value);
      }

      detect = vi.fn().mockResolvedValue([]);
    }
    vi.stubGlobal("BarcodeDetector", BarcodeDetector);

    expect(await createBarcodeDetector()).toBeInstanceOf(BarcodeDetector);
    expect(options).toEqual([{ formats: ["qr_code"] }]);
  });

  it("does not use a detector that cannot scan QR codes", async () => {
    const constructor = vi.fn();
    class BarcodeDetector {
      static getSupportedFormats = vi.fn().mockResolvedValue(["aztec"]);

      constructor() {
        constructor();
      }

      detect = vi.fn().mockResolvedValue([]);
    }
    vi.stubGlobal("BarcodeDetector", BarcodeDetector);

    await expect(createBarcodeDetector()).resolves.toBeUndefined();
    expect(constructor).not.toHaveBeenCalled();
  });
});

describe("startScanLoop", () => {
  it("prefers BarcodeDetector over the fallback decoder", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("HTMLMediaElement", { HAVE_CURRENT_DATA: 2 });
    const readFrame = vi.fn().mockResolvedValue("fallback");
    const camera = { readFrame } as unknown as QRCamera;
    const createCanvas = vi.fn(() => ({}) as QRCanvas);
    const detector = {
      detect: vi.fn().mockResolvedValue([{ rawValue: "native" }]),
    };
    const onScanned = vi.fn();
    const onError = vi.fn();

    const stop = startScanLoop(
      { readyState: 2 } as HTMLVideoElement,
      camera,
      createCanvas,
      detector,
      onScanned,
      onError,
    );
    await vi.advanceTimersByTimeAsync(100);
    stop();

    expect(detector.detect).toHaveBeenCalledOnce();
    expect(createCanvas).not.toHaveBeenCalled();
    expect(readFrame).not.toHaveBeenCalled();
    expect(onScanned).toHaveBeenCalledWith("native");
    expect(onError).not.toHaveBeenCalled();
  });

  it("falls back when the native detector fails", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("HTMLMediaElement", { HAVE_CURRENT_DATA: 2 });
    const readFrame = vi.fn().mockResolvedValue("fallback");
    const camera = { readFrame } as unknown as QRCamera;
    const canvas = {} as QRCanvas;
    const createCanvas = vi.fn(() => canvas);
    const detector = {
      detect: vi.fn().mockRejectedValue(new Error("Unavailable")),
    };
    const onScanned = vi.fn();
    const onError = vi.fn();

    const stop = startScanLoop(
      { readyState: 2 } as HTMLVideoElement,
      camera,
      createCanvas,
      detector,
      onScanned,
      onError,
    );
    await vi.advanceTimersByTimeAsync(100);
    stop();

    expect(createCanvas).toHaveBeenCalledOnce();
    expect(readFrame).toHaveBeenCalledWith(canvas, true);
    expect(readFrame).toHaveBeenCalledOnce();
    expect(onScanned).toHaveBeenCalledWith("fallback");
    expect(onError).not.toHaveBeenCalled();
  });
});
