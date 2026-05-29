import Link from 'next/link';
import Image from 'next/image';
import { ArrowUpRight } from 'lucide-react';
import { appName, appSlogan, externalLinks } from '@/lib/shared';
import { getDictionary } from '@/lib/dictionary';
import cccLogo from '@/public/ccc-logo.svg';

/* --------------------------------------------------------------------------
 * Brand glyphs — inlined as SVGs because lucide-react v1+ removed brand icons
 * for trademark-compliance reasons. Kept ultra-minimal (single path each)
 * so they tree-shake away if unused and inherit currentColor like Lucide.
 * -------------------------------------------------------------------------- */
function GithubGlyph(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      {...props}
    >
      <path d="M12 .5C5.73.5.66 5.57.66 11.84c0 5.02 3.25 9.27 7.76 10.77.57.1.78-.25.78-.55v-2.1c-3.16.69-3.83-1.36-3.83-1.36-.51-1.3-1.26-1.65-1.26-1.65-1.03-.7.08-.69.08-.69 1.14.08 1.74 1.17 1.74 1.17 1.01 1.74 2.66 1.24 3.31.95.1-.74.4-1.24.72-1.53-2.52-.29-5.17-1.26-5.17-5.61 0-1.24.44-2.25 1.16-3.05-.12-.29-.5-1.44.11-3 0 0 .95-.3 3.12 1.16.9-.25 1.87-.38 2.83-.38.96 0 1.93.13 2.83.38 2.17-1.46 3.12-1.16 3.12-1.16.61 1.56.23 2.71.11 3 .72.8 1.16 1.81 1.16 3.05 0 4.36-2.66 5.31-5.19 5.6.41.35.77 1.03.77 2.08v3.08c0 .3.21.66.79.55 4.5-1.5 7.75-5.75 7.75-10.77C23.34 5.57 18.27.5 12 .5z" />
    </svg>
  );
}

function XGlyph(props: React.SVGProps<SVGSVGElement>) {
  // Modern X / Twitter wordmark glyph. Uses currentColor for theme parity.
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      {...props}
    >
      <path d="M18.244 2H21.5l-7.5 8.57L23 22h-6.78l-5.31-6.94L4.8 22H1.54l8.04-9.18L1 2h6.94l4.8 6.34L18.244 2zm-1.18 18h1.86L7.02 4H5.06l12.004 16z" />
    </svg>
  );
}

/**
 * Site-wide footer rendered below home / blog pages.
 *
 * Editorial-leaning layout: brand block on the left with a quietly oversized
 * slogan, three short link columns on the right, and a hairline-divided
 * baseline carrying the copyright + small social marks. Mirrors the home
 * page's mono micro-eyebrows and hairline rhythm so it feels like part of
 * the same publication rather than a tacked-on chrome element.
 */
export function Footer({ lang }: { lang: string }) {
  const t = getDictionary(lang).footer;
  const year = new Date().getFullYear();

  // Internal product links — keep locale-prefixed so navigation stays in-language.
  const product: { label: string; href: string; external?: boolean }[] = [
    { label: t.links.docs, href: `/${lang}/docs` },
    /*{ label: t.links.blog, href: `/${lang}/blog` },*/
    { label: t.links.playground, href: externalLinks.playground, external: true },
    { label: t.links.demo, href: externalLinks.demo, external: true },
  ];

  const resources: { label: string; href: string }[] = [
    { label: t.links.api, href: externalLinks.api },
    { label: t.links.github, href: externalLinks.github },
  ];

  const community: { label: string; href: string }[] = [
    { label: t.links.githubOrg, href: externalLinks.githubOrg },
    { label: t.links.twitter, href: externalLinks.twitter },
    { label: t.links.talk, href: externalLinks.talk },
  ];

  return (
    <footer className="relative border-t border-hairline overflow-hidden">
      {/* Quiet grid texture, masked to fade at edges — same vocabulary as the hero. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-grid text-fd-border/25 mask-radial-fade"
      />
      <div className="relative mx-auto w-full max-w-6xl px-6 py-16 md:py-20">
        {/* Top row: brand block + link columns. */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-10 md:gap-8">
          {/* Brand block */}
          <div className="md:col-span-5">
            <p className="font-mono text-[11px] tracking-widest uppercase text-fd-muted-foreground mb-4">
              // {t.builtBy}
            </p>
            <Link
              href={`/${lang}`}
              className="inline-flex items-center gap-2.5 group"
            >
              <Image
                src={cccLogo}
                alt={appName}
                width={28}
                height={28}
                className="size-7"
              />
              <span className="text-lg font-semibold tracking-tight group-hover:text-fd-primary transition-colors">
                @ckb-ccc
              </span>
            </Link>
            {/* Slogan — oversized but soft, no shouting. */}
            <p className="mt-5 text-2xl md:text-3xl font-semibold tracking-tight leading-[1.15] max-w-md">
              {appSlogan}
              <span className="text-fd-primary">.</span>
            </p>
          </div>

          {/* Link columns */}
          <FooterColumn title={t.product} links={product} />
          <FooterColumn title={t.resources} links={resources} />
          <FooterColumn title={t.community} links={community} />
        </div>

        {/* Baseline — hairline rule, copyright, small social marks. */}
        <div className="mt-14 pt-6 border-t border-hairline flex flex-col-reverse sm:flex-row items-start sm:items-center justify-between gap-4">
          <p className="font-mono text-[11px] tracking-widest uppercase text-fd-muted-foreground">
            © {year} {t.copyright}
          </p>
          <div className="flex items-center gap-1">
            <SocialIcon
              href={externalLinks.githubOrg}
              label={t.links.githubOrg}
              icon={<GithubGlyph className="size-4" />}
            />
            <SocialIcon
              href={externalLinks.twitter}
              label={t.links.twitter}
              icon={<XGlyph className="size-[14px]" />}
            />
          </div>
        </div>
      </div>
    </footer>
  );
}

function FooterColumn({
  title,
  links,
}: {
  title: string;
  links: { label: string; href: string; external?: boolean }[];
}) {
  return (
    <div className="md:col-span-2">
      <p className="font-mono text-[11px] tracking-widest uppercase text-fd-muted-foreground mb-4">
        {title}
      </p>
      <ul className="space-y-2.5">
        {links.map((l) => {
          const isExternal = l.external ?? l.href.startsWith('http');
          return (
            <li key={l.label}>
              {isExternal ? (
                <a
                  href={l.href}
                  target="_blank"
                  rel="noreferrer"
                  className="group inline-flex items-center gap-1 text-sm text-fd-foreground/80 hover:text-fd-primary transition-colors"
                >
                  {l.label}
                  <ArrowUpRight className="size-3 opacity-0 -translate-x-0.5 group-hover:opacity-100 group-hover:translate-x-0 transition-all" />
                </a>
              ) : (
                <Link
                  href={l.href}
                  className="text-sm text-fd-foreground/80 hover:text-fd-primary transition-colors"
                >
                  {l.label}
                </Link>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function SocialIcon({
  href,
  label,
  icon,
}: {
  href: string;
  label: string;
  icon: React.ReactNode;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      aria-label={label}
      title={label}
      className="size-9 inline-flex items-center justify-center rounded-md text-fd-muted-foreground hover:text-fd-primary hover:bg-fd-primary/10 transition-colors"
    >
      {icon}
    </a>
  );
}
