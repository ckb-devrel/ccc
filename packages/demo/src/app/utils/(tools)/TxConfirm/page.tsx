"use client";

import { Loader2 } from "lucide-react";

export function TxConfirm({
  isOpen,
  message,
  txHash,
}: {
  isOpen: boolean;
  message: string;
  txHash?: string;
}) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="relative mx-4 w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-purple-500" />
          <div className="text-center">
            <p className="text-lg font-semibold text-gray-800">{message}</p>
            {txHash && (
              <p className="mt-2 text-sm break-all text-gray-600">{txHash}</p>
            )}
            <p className="mt-4 text-sm text-gray-500">
              Please wait for transaction confirmation...
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
