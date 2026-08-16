"use client";

import { Check, Copy } from "lucide-react";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { copyText } from "./copy-text";

export function CopyableReadoutValue({
  children,
  onError,
  value,
}: {
  children?: ReactNode;
  onError?: (cause: unknown) => void;
  value: string;
}) {
  const [copiedValue, setCopiedValue] = useState<string>();
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
        setCopiedValue(value);
        copyTimer.current = setTimeout(() => setCopiedValue(undefined), 900);
      })
      .catch((cause) => onError?.(cause));
  };

  return (
    <button
      type="button"
      onClick={copy}
      title="Copy value"
      aria-label="Copy value"
    >
      <strong>{children ?? value}</strong>
      {copiedValue === value ? <Check size={15} /> : <Copy size={15} />}
    </button>
  );
}
