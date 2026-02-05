"use client";

import { Button } from "@/src/components/Button";
import { Upload, X } from "lucide-react";
import { useRef, useState } from "react";

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

function formatDate(date: Date): string {
  return date.toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

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

export function FileUploadArea({
  file,
  onFileChange,
}: {
  file: File | null;
  onFileChange: (file: File | null) => void;
}) {
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
      className={`relative my-4 rounded-lg border-2 border-dashed p-8 transition-colors ${
        isDragging
          ? "border-purple-500 bg-purple-50"
          : "border-gray-300 bg-white/75"
      }`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        onChange={handleFileInputChange}
      />

      {!file ? (
        <div className="flex flex-col items-center justify-center gap-4">
          <Upload className="h-12 w-12 text-gray-400" />
          <div className="text-center">
            <p className="text-lg font-semibold text-gray-700">
              Drag and drop a file here, or click to select
            </p>
            <p className="mt-2 text-sm text-gray-500">
              Select a file from your computer
            </p>
          </div>
          <Button variant="info" onClick={() => fileInputRef.current?.click()}>
            Select File
          </Button>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="mb-2 flex items-center gap-2">
                <Upload className="h-5 w-5 text-purple-500" />
                <p className="text-lg font-semibold text-gray-800">
                  {file.name}
                </p>
              </div>
              <div className="ml-7 space-y-1 text-sm text-gray-600">
                <p>
                  <span className="font-medium">Size:</span>{" "}
                  {formatFileSize(file.size)}
                </p>
                <p>
                  <span className="font-medium">Type:</span>{" "}
                  {file.type || "Unknown"}
                </p>
                <p>
                  <span className="font-medium">Modified:</span>{" "}
                  {formatDate(new Date(file.lastModified))}
                </p>
              </div>
            </div>
            <button
              onClick={handleClearFile}
              className="ml-4 rounded-full p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
              aria-label="Clear file"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          <Button
            variant="info"
            onClick={() => fileInputRef.current?.click()}
            className="self-start"
          >
            Change File
          </Button>
        </div>
      )}
    </div>
  );
}
