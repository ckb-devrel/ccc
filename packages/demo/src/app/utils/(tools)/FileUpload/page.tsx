"use client";

import { ccc } from "@ckb-ccc/connector-react";
import { ArrowLeftRight, Upload, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

export async function readFileAsBytes(file: File): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      if (e.target?.result instanceof ArrayBuffer) {
        resolve(new Uint8Array(e.target.result));
      } else {
        reject(new Error("Failed to read file"));
      }
    };
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsArrayBuffer(file);
  });
}

function FileDataHash({ file }: { file: File }) {
  const [dataHash, setDataHash] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    readFileAsBytes(file)
      .then((bytes) => {
        if (!cancelled) setDataHash(ccc.hashCkb(bytes));
      })
      .catch(() => {
        if (!cancelled) setDataHash("Unavailable");
      });

    return () => {
      cancelled = true;
    };
  }, [file]);

  return (
    <p>
      <span className="font-medium">Data Hash:</span>{" "}
      <span className="font-mono break-all">
        {dataHash ?? "Calculating..."}
      </span>
    </p>
  );
}

export default function FileUploadArea({
  file,
  onFileChange,
  fileInputRef: externalFileInputRef,
  toOccupy,
  immutable = false,
  onImmutableChange,
  children,
}: {
  file: File | null;
  onFileChange: (file: File | null) => void;
  fileInputRef?: React.RefObject<HTMLInputElement | null>;
  toOccupy?: string;
  immutable?: boolean;
  onImmutableChange?: () => void;
  children?: React.ReactNode;
}) {
  const [isDragging, setIsDragging] = useState(false);
  const internalFileInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = externalFileInputRef ?? internalFileInputRef;

  const handleFileSelect = (selectedFile: File) => {
    onFileChange(selectedFile);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) {
      handleFileSelect(droppedFile);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (file || (e.key !== "Enter" && e.key !== " ")) return;
    e.preventDefault();
    fileInputRef.current?.click();
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      handleFileSelect(selectedFile);
    }
  };

  const handleClearFile = () => {
    onFileChange(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  return (
    <div
      className={`relative my-4 overflow-hidden rounded-lg border-2 transition-colors ${
        isDragging
          ? "border-purple-500 bg-purple-50"
          : "border-gray-300 bg-white/75"
      }`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {children && (
        <div className="border-b-2 border-dashed border-gray-300 p-8">
          {children}
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        onClick={(e) => e.stopPropagation()}
        onChange={handleFileInputChange}
      />

      {!file ? (
        <div
          className="flex cursor-pointer flex-col items-center justify-center gap-4 p-8 transition-colors hover:bg-purple-50/70"
          onClick={() => fileInputRef.current?.click()}
          onKeyDown={handleKeyDown}
          role="button"
          tabIndex={0}
          aria-label="Select file"
        >
          <Upload className="h-12 w-12 text-purple-500" />
          <div className="text-center">
            <p className="text-lg font-semibold text-gray-700">
              Drag and drop a file here, or click to select
            </p>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-4 p-8">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="mb-2 flex max-w-full items-center gap-2 text-left text-gray-800 transition-colors hover:text-purple-500"
                aria-label={`Replace ${file.name}`}
                title="Replace file"
              >
                <Upload className="h-5 w-5 text-purple-500" />
                <span className="min-w-0 text-lg font-semibold break-all">
                  {file.name}
                </span>
                <ArrowLeftRight className="h-4 w-4 shrink-0" />
              </button>
              <div className="space-y-1 text-sm text-gray-600">
                <p>
                  <span className="font-medium">To Occupy:</span>{" "}
                  {toOccupy ?? "Calculating..."}
                </p>
                <FileDataHash file={file} />
                {immutable && (
                  <p className="text-green-700">
                    This cell will become immutable and can never be updated.
                  </p>
                )}
              </div>
            </div>
            <button
              onClick={handleClearFile}
              className="ml-4 rounded-full p-1 text-gray-400 transition-colors hover:text-gray-700"
              aria-label="Clear file"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          {onImmutableChange && (
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-gray-600">
                Options:
              </span>
              <button
                type="button"
                onClick={onImmutableChange}
                aria-pressed={immutable}
                className={`rounded-full border px-3 py-1 text-sm font-medium transition-colors ${
                  immutable
                    ? "border-green-300 bg-green-100 text-emerald-600"
                    : "border-dashed border-neutral-300 bg-neutral-100 text-gray-600"
                }`}
              >
                Immutable
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
