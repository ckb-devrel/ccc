type NpmBadgeVariant = "version" | "downloads-week" | "downloads-month" | "downloads-total";

const BADGE_URL: Record<NpmBadgeVariant, (pkg: string) => string> = {
  "version":         (pkg) => `https://img.shields.io/npm/v/${encodeURIComponent(pkg)}`,
  "downloads-week":  (pkg) => `https://img.shields.io/npm/dw/${encodeURIComponent(pkg)}`,
  "downloads-month": (pkg) => `https://img.shields.io/npm/dm/${encodeURIComponent(pkg)}`,
  "downloads-total": (pkg) => `https://img.shields.io/npm/dt/${encodeURIComponent(pkg)}`,
};

const BADGE_ALT: Record<NpmBadgeVariant, string> = {
  "version":         "npm version",
  "downloads-week":  "npm downloads per week",
  "downloads-month": "npm downloads per month",
  "downloads-total": "npm total downloads",
};

export function NpmBadge({
  pkg,
  variant = "version",
  className,
}: {
  pkg: string;
  variant?: NpmBadgeVariant;
  className?: string;
}) {
  return (
    <a
      href={`https://www.npmjs.com/package/${pkg}`}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-block w-fit"
    >
      <img
        src={BADGE_URL[variant](pkg)}
        alt={`${pkg} ${BADGE_ALT[variant]}`}
        className={`not-prose ${className ?? "m-0! inline"}`}
      />
    </a>
  );
}