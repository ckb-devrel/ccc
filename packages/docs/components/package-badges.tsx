import { NpmBadge } from "./npm-badge";

export function PackageBadges({ pkg }: { pkg: string }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <NpmBadge pkg={pkg} variant="version" />
      <NpmBadge pkg={pkg} variant="downloads-week" />
    </div>
  );
}