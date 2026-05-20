export function InstallHeading({ title, pkg }: { title: string, pkg: string }) {
  return (
      <h2 className="flex scroll-m-28 flex-row items-center gap-2" id="installation">
        <a data-card href="#installation" className="peer">
          {title} 
        </a>
        <svg
        xmlns="http://www.w3.org/2000/svg"
        width="24" height="24" viewBox="0 0 24 24"
        fill="none" stroke="currentColor" strokeWidth="2"
        strokeLinecap="round" strokeLinejoin="round"
        className="lucide lucide-link size-3.5 shrink-0 text-fd-muted-foreground opacity-0 transition-opacity peer-hover:opacity-100"
        aria-hidden="true"
      >
        <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
        <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
      </svg>
      <a href={`https://www.npmjs.com/package/${pkg}`} target="_blank" rel="noopener noreferrer" className="flex items-center ml-1 h-8">
        <img
          src={`https://img.shields.io/npm/v/${encodeURIComponent(pkg)}?style=flat-square`}
          alt={`${pkg} npm version`}
        />
      </a>
      </h2>
  );
}