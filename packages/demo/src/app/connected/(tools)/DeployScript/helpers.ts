/** Normalize Type ID args (strip 0x, trim). */
export function normalizeTypeIdArgs(args: string): string {
  const s = (args || "").trim();
  return s.startsWith("0x") ? s.slice(2) : s;
}

/** Split Type ID args into up to 4 display lines. */
export function typeIdArgsToFourLines(args: string): string[] {
  const str = args || "";
  if (!str.length) return [];
  const chunkSize = Math.ceil(str.length / 4);
  return [
    str.slice(0, chunkSize),
    str.slice(chunkSize, chunkSize * 2),
    str.slice(chunkSize * 2, chunkSize * 3),
    str.slice(chunkSize * 3),
  ].filter(Boolean);
}
