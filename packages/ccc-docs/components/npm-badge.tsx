export function NpmBadge({ pkg, className }: { pkg: string, className?: string }) {
  return (
    <a
      href={`https://www.npmjs.com/package/${pkg}`}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-block w-fit"
    >
      <img
        src={`https://img.shields.io/npm/v/${encodeURIComponent(pkg)}?style=flat-square`}
        alt={`${pkg} npm version`}
        className={className ?? "m-0! inline"}
      />
    </a>
  );
}