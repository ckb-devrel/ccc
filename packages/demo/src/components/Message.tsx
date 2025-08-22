import { CircleCheck, CircleX, Lightbulb } from "lucide-react";
import React, { useState } from "react";

export interface MessageProps {
  children: React.ReactNode;
  title?: string;
  type?: "error" | "warning" | "info" | "success";
  lines?: number;
  className?: string;
}

export function Message({
  children,
  title,
  type = "info",
  lines,
  className = "",
}: MessageProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  let colorClass = "";
  let bgColorClass = "";

  switch (type) {
    case "error":
      colorClass = "text-red-800";
      bgColorClass = "bg-red-100";
      break;
    case "warning":
      colorClass = "text-yellow-800";
      bgColorClass = "bg-yellow-100";
      break;
    case "success":
      colorClass = "text-green-800";
      bgColorClass = "bg-green-100";
      break;
    case "info":
    default:
      colorClass = "text-gray-800";
      bgColorClass = "bg-gray-100";
      break;
  }

  return (
    <div
      onClick={() => setIsExpanded(!isExpanded)}
      className={`my-2 flex cursor-pointer flex-col items-start rounded-md p-4 ${bgColorClass} ${className}`}
    >
      {title ? (
        <div className="flex w-full items-center">
          {type === "info" && <Lightbulb className={`mr-3 ${colorClass}`} />}
          {type === "error" && <CircleX className={`mr-3 ${colorClass}`} />}
          {type === "success" && (
            <CircleCheck className={`mr-3 ${colorClass}`} />
          )}
          <p className={`font-semibold ${colorClass}`}>{title}</p>
        </div>
      ) : undefined}
      <div
        className={`relative mt-2 ${isExpanded ? "" : "line-clamp-1"}`}
        style={
          isExpanded
            ? {}
            : {
                WebkitLineClamp: `${lines ?? 2}`,
              }
        }
      >
        <p className={`whitespace-pre-wrap break-all text-sm ${colorClass}`}>
          {children}
        </p>
      </div>
    </div>
  );
}
