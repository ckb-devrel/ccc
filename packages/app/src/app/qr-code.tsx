"use client";

import encodeQR from "qr";
import type { CSSProperties } from "react";
import { useMemo } from "react";
import styles from "./qr-code.module.css";

export type QrCodeProps = {
  value?: string;
  title?: string;
  size?: number | string;
  className?: string;
};

type QrCodeStyle = CSSProperties & {
  "--qr-code-size"?: string;
};

export function QrCode({
  value,
  title = "QR code",
  size,
  className,
}: QrCodeProps) {
  const qr = useMemo(() => {
    if (!value) {
      return;
    }

    const matrix = encodeQR(value, "raw", { border: 2, ecc: "medium" });
    return {
      path: matrix
        .flatMap((row, y) =>
          row.map((dark, x) => (dark ? `M${x} ${y}h1v1h-1z` : "")),
        )
        .join(""),
      size: matrix.length,
    };
  }, [value]);
  const style: QrCodeStyle | undefined =
    size === undefined
      ? undefined
      : {
          "--qr-code-size": typeof size === "number" ? `${size}px` : size,
        };

  return (
    <div
      className={[styles.root, className].filter(Boolean).join(" ")}
      style={style}
      aria-live="polite"
    >
      {qr ? (
        <svg
          className={styles.image}
          viewBox={`0 0 ${qr.size} ${qr.size}`}
          role="img"
        >
          <title>{title}</title>
          <path d={qr.path} />
        </svg>
      ) : (
        <span className={styles.placeholder} aria-hidden="true" />
      )}
    </div>
  );
}
