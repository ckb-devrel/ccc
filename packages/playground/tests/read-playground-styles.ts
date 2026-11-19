import { readFileSync } from "node:fs";

export function readPlaygroundStyles(): string {
  const entry = new URL("../src/app/globals.css", import.meta.url);
  return readFileSync(entry, "utf8").replace(
    /^@import "(\.\/styles\/[^"]+\.css)";$/gm,
    (_, path: string) => readFileSync(new URL(path, entry), "utf8"),
  );
}
