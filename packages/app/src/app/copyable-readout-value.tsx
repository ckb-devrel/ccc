"use client";

import { type ReactNode } from "react";
import { CopyableText } from "./copyable-text";

export function CopyableReadoutValue({
  children,
  onError,
  value,
}: {
  children?: ReactNode;
  onError?: (cause: unknown) => void;
  value: string;
}) {
  return (
    <CopyableText
      value={value}
      onError={onError}
      title="Copy value"
      iconSize={15}
    >
      <strong>{children ?? value}</strong>
    </CopyableText>
  );
}
