import { ReactNode } from "react";

export function Button(
  props: {
    icon?: ReactNode;
    variant?: "info" | "primary" | "success" | "danger";
    as?: "button" | "a";
  } & React.ComponentPropsWithoutRef<"button"> &
    React.ComponentPropsWithoutRef<"a">,
) {
  const classes = {
    info: "border-neutral-300 bg-neutral-100 text-black",
    primary: "border-neutral-400 bg-neutral-800 text-white",
    success: "border-green-300 bg-green-100 text-emerald-600",
    danger: "border-red-500 bg-red-300 text-red-700",
  }[props.variant ?? "primary"];

  const Tag = props.as ?? "button";

  return (
    <Tag
      {...props}
      className={`flex items-center justify-center rounded-full px-4 py-2 font-bold no-underline disabled:opacity-70 ${classes} ${props.className}`}
      style={{
        borderWidth: "3px",
        ...(props.style ?? {}),
      }}
    >
      {props.icon ? <div className="mr-2">{props.icon}</div> : undefined}
      {props.children}
    </Tag>
  );
}
