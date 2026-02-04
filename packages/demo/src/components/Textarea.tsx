import React from "react";

export function Textarea(
  props: React.ComponentPropsWithoutRef<"textarea"> & {
    state: [string, (v: string) => void];
    label?: React.ReactNode;
  },
) {
  return (
    <div className={`relative bg-white/75 p-4 ${props.className ?? ""}`}>
      {props.label ? (
        <label className="flex items-center text-sm">{props.label}</label>
      ) : undefined}
      <textarea
        {...props}
        className={`mt-1 min-h-20 w-full rounded border-2 border-gray-300 bg-transparent px-4 py-2 text-gray-700 focus:border-solid focus:outline-none ${props.state[0].length !== 0 ? "border-solid" : "border-dashed"}`}
        value={props.state[0]}
        onInput={(e) => props.state[1](e.currentTarget.value)}
      />
    </div>
  );
}
