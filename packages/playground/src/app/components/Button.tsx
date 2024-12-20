export function Button(props: React.ComponentPropsWithoutRef<"button">) {
  return (
    <button
      {...props}
      className={`flex shrink-0 items-center border-gray-600 disabled:bg-gray-600 border px-4 font-bold py-1 text-white whitespace-nowrap ${props.className}`}
    ></button>
  );
}
