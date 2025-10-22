export function Button(props: React.ComponentPropsWithoutRef<"button">) {
  return (
    <button
      {...props}
      className={`flex shrink-0 items-center border border-gray-600 px-4 py-1 font-bold whitespace-nowrap text-white disabled:bg-gray-600 ${props.className}`}
    ></button>
  );
}
