"use client";

import { Check, Copy } from "lucide-react";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { copyText } from "./copy-text";

export function CopyableText({
  ariaLabel = "Copy value",
  children,
  className,
  iconSize = 12,
  onError,
  title,
  value,
}: {
  ariaLabel?: string;
  children?: ReactNode;
  className?: string;
  iconSize?: number;
  onError?: (cause: unknown) => void;
  title?: string;
  value: string;
}) {
  const [copied, setCopied] = useState(false);
  const copyTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(
    () => () => {
      clearTimeout(copyTimer.current);
    },
    [],
  );

  const copy = () => {
    void copyText(value)
      .then(() => {
        clearTimeout(copyTimer.current);
        setCopied(true);
        copyTimer.current = setTimeout(() => setCopied(false), 900);
      })
      .catch((cause) => onError?.(cause));
  };

  return (
    <button
      className={className}
      data-copied={copied || undefined}
      type="button"
      title={title ?? value}
      aria-label={ariaLabel}
      onClick={copy}
    >
      {children ?? <span>{value}</span>}
      <span className="copyable-text-icon" aria-hidden="true">
        {copied ? <Check size={iconSize} /> : <Copy size={iconSize} />}
      </span>
    </button>
  );
}
