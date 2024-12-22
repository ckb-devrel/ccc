import { icons } from "lucide-react";
import { RandomWalk } from "./RandomWalk";

export function BigButton({
  iconName,
  size,
  ...props
}: {
  iconName: keyof typeof icons;
  size?: "md" | "sm";
} & React.ComponentPropsWithoutRef<"button">) {
  const [classes, iconClasses] = {
    md: ["h-40 w-40 p-24 text-2xl", "h-20 w-20 md:h-24 md:w-24"],
    sm: ["h-24 w-24 p-16 text-lg", "h-16 w-16 md:h-20 md:w-20"],
  }[size ?? "md"];

  const Icon = icons[iconName];

  return (
    <button
      {...props}
      className={`relative flex items-center justify-center rounded rounded-full border bg-white font-bold shadow-md ${classes} ${props.className ?? ""}`}
    >
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 opacity-15">
        <RandomWalk>
          <Icon className={iconClasses} />
        </RandomWalk>
      </div>

      <div className="flex flex-col items-center gap-2">{props.children}</div>
    </button>
  );
}
