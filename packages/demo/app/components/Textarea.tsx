export function Textarea(
  props: React.InputHTMLAttributes<HTMLTextAreaElement> & {
    state: [string, (v: string) => void];
    label?: string;
  },
) {
  return (
    <div className="flex w-96 flex-col gap-1">
      <label>{props.label ? props.label : "Input"}</label>
      <textarea
        {...props}
        className={`min-h-40 w-full rounded border border-gray-700 px-4 py-2 ${props.className ?? ""}`}
        value={props.state[0]}
        onInput={(e) => props.state[1](e.currentTarget.value)}
      />
    </div>
  );
}
