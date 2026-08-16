import { QRCodeSVG } from "qrcode.react";
import type { CSSProperties } from "react";

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
  const style: QrCodeStyle | undefined =
    size === undefined
      ? undefined
      : {
          "--qr-code-size": typeof size === "number" ? `${size}px` : size,
        };

  return (
    <div
      className={["qr-code", className].filter(Boolean).join(" ")}
      style={style}
      aria-live="polite"
    >
      {value ? (
        <QRCodeSVG
          className="qr-code-image"
          value={value}
          level="M"
          marginSize={2}
          bgColor="none"
          fgColor="var(--muted)"
          title={title}
          style={{ background: "transparent" }}
        />
      ) : (
        <span className="qr-code-placeholder" aria-hidden="true" />
      )}
    </div>
  );
}
