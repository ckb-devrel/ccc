import { CircleCheck, CircleX, Lightbulb } from "lucide-react";
import React, { useState } from "react";

export interface MessageProps {
  children: React.ReactNode;
  title?: string;
  type?: "error" | "warning" | "info" | "success";
  lines?: number;
  className?: string;
  expandable?: boolean;
}

export function Message({
  children,
  title,
  type = "info",
  lines,
  className = "",
  expandable = true,
}: MessageProps) {
  const [isExpanded, setIsExpanded] = useState(!expandable);

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

  const showFull = expandable ? isExpanded : true;

  return (
    <div
      onClick={expandable ? () => setIsExpanded(!isExpanded) : undefined}
      className={`my-2 flex flex-col items-start rounded-md p-4 ${bgColorClass} ${className} ${expandable ? "cursor-pointer" : ""}`}
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
        className={`relative mt-2 ${showFull ? "" : "line-clamp-1"}`}
        style={
          showFull
            ? {}
            : {
                WebkitLineClamp: `${lines ?? 2}`,
              }
        }
      >
        <div className={`text-sm break-all whitespace-pre-wrap ${colorClass}`}>
          {children}
        </div>
      </div>
    </div>
  );
}
