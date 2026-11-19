export function Button({
  className = "",
  type = "button",
  ...props
}: React.ComponentPropsWithoutRef<"button">) {
  return (
    <button {...props} type={type} className={`control-button ${className}`} />
  );
}
