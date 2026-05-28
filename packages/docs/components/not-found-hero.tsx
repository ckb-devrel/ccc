import Link from 'next/link';
import { ArrowRight, ArrowUpLeft } from 'lucide-react';

/**
 * Reusable 404 hero shared by every not-found page.
 *
 * Visual vocabulary mirrors the landing page (`app/[lang]/(home)/page.tsx`):
 *   - mono eyebrow with a pulsing primary dot
 *   - large two-line title with the second half tinted in fd-primary
 *   - quiet radial-faded dot grid background
 *   - a glyph block on the right that echoes the hero's code-card framing
 *
 * The component is dumb: pass i18n copy and link targets in.
 */
export interface NotFoundCta {
  label: string;
  href: string;
  /** Visual emphasis. Primary uses the brand button; secondary is bordered. */
  variant?: 'primary' | 'secondary';
  /** Render as <a target="_blank"> for off-site CTAs. Default false. */
  external?: boolean;
}

export interface NotFoundHeroProps {
  eyebrow: string;
  /** [first line, accent line] — accent line is rendered in fd-primary. */
  title: [string, string];
  subtitle: string;
  ctas: NotFoundCta[];
  /** Glyph rendered inside the right-hand decorative card. Defaults to `404`. */
  glyph?: React.ReactNode;
  /**
   * Tiny mono caption shown in the card titlebar — same affordance the home
   * hero uses for the file name above the code preview.
   */
  glyphCaption?: string;
  /**
   * Compact, single-column layout for narrow containers (e.g. the docs
   * article column). Drops the side-by-side grid in favour of a vertical
   * stack so the title doesn't wrap awkwardly.
   */
  compact?: boolean;
}

export function NotFoundHero({
  eyebrow,
  title,
  subtitle,
  ctas,
  glyph = '404',
  glyphCaption = 'status: 404 not_found',
  compact = false,
}: NotFoundHeroProps) {
  return (
    <section className="relative flex flex-1 overflow-hidden">
      {/* Quiet dot-grid texture, masked to fade at the edges — same pattern
          as the landing hero so the surface feels native to the site. */}
      <div
        aria-hidden
        className="absolute inset-0 -z-10 bg-grid text-fd-muted-foreground/25 mask-radial-fade"
      />

      {compact ? (
        <CompactBody
          eyebrow={eyebrow}
          title={title}
          subtitle={subtitle}
          ctas={ctas}
        />
      ) : (
        <FullBody
          eyebrow={eyebrow}
          title={title}
          subtitle={subtitle}
          ctas={ctas}
          glyph={glyph}
          glyphCaption={glyphCaption}
        />
      )}
    </section>
  );
}

/** Wide-page layout shared by global / blog 404 — split into copy + card. */
function FullBody({
  eyebrow,
  title,
  subtitle,
  ctas,
  glyph,
  glyphCaption,
}: Required<Omit<NotFoundHeroProps, 'compact'>>) {
  return (
    <div className="mx-auto w-full max-w-6xl px-6 py-20 md:py-28 grid gap-14 md:grid-cols-5 md:items-center">
      {/* Left column — copy + CTAs */}
      <div className="md:col-span-3">
          <div className="inline-flex items-center gap-2 font-mono text-[11px] tracking-widest text-fd-primary uppercase mb-5">
            <span className="size-1.5 rounded-full bg-fd-primary animate-pulse" />
            {eyebrow}
          </div>
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-semibold tracking-tight leading-[1.05] mb-6">
            {title[0]}
            <br />
            <span className="text-fd-primary">{title[1]}</span>
          </h1>
          <p className="text-fd-muted-foreground text-base md:text-lg leading-relaxed max-w-xl mb-8">
            {subtitle}
          </p>
          <div className="flex items-center gap-3 flex-wrap">
            {ctas.map((cta) => {
              const isPrimary = (cta.variant ?? 'primary') === 'primary';
              const className = isPrimary
                ? 'group inline-flex items-center gap-1.5 rounded-md bg-fd-primary px-4 py-2.5 text-sm font-medium text-fd-primary-foreground hover:opacity-90 transition-opacity'
                : 'group inline-flex items-center gap-1.5 rounded-md border px-4 py-2.5 text-sm font-medium hover:bg-fd-muted transition-colors';

              const Icon = isPrimary ? ArrowRight : ArrowUpLeft;
              const iconClassName = isPrimary
                ? 'size-4 transition-transform group-hover:translate-x-0.5'
                : 'size-4 transition-transform group-hover:-translate-x-0.5';

              if (cta.external) {
                return (
                  <a
                    key={cta.href}
                    href={cta.href}
                    target="_blank"
                    rel="noreferrer"
                    className={className}
                  >
                    {cta.label}
                    <Icon className={iconClassName} />
                  </a>
                );
              }

              return (
                <Link key={cta.href} href={cta.href} className={className}>
                  {cta.label}
                  <Icon className={iconClassName} />
                </Link>
              );
            })}
          </div>
        </div>

        {/* Right column — decorative glyph card. Mirrors the home hero's
            code-card chrome so the page feels like a sibling, not an outlier. */}
        <div className="md:col-span-2 relative">
          <div
            aria-hidden
            className="absolute -inset-4 -z-10 rounded-xl bg-fd-primary/10 blur-2xl opacity-60"
          />
          <div className="rounded-lg border bg-fd-card/80 backdrop-blur-sm overflow-hidden shadow-sm">
            <div className="flex items-center gap-1.5 px-3.5 py-2.5 border-b border-hairline bg-fd-muted/30">
              <span className="size-2.5 rounded-full bg-fd-muted-foreground/25" />
              <span className="size-2.5 rounded-full bg-fd-muted-foreground/25" />
              <span className="size-2.5 rounded-full bg-fd-muted-foreground/25" />
              <span className="ml-2 font-mono text-[11px] text-fd-muted-foreground">
                {glyphCaption}
              </span>
            </div>
            <div className="flex items-center justify-center px-6 py-12 md:py-16">
              <div className="font-mono text-7xl md:text-8xl font-semibold tracking-tight text-fd-primary/90 select-none">
                {glyph}
              </div>
            </div>
          </div>
        </div>
      </div>
  );
}

/**
 * Compact, single-column variant for narrow containers (the docs article
 * column). Drops the side-by-side decorative card entirely — the mono
 * eyebrow is enough of a status cue at this size, and removing the redundant
 * "404" chip keeps the page feeling like a docs page rather than a poster.
 */
function CompactBody({
  eyebrow,
  title,
  subtitle,
  ctas,
}: Pick<NotFoundHeroProps, 'eyebrow' | 'title' | 'subtitle' | 'ctas'>) {
  return (
    <div className="mx-auto w-full max-w-2xl px-2 py-12 md:py-16">
      {/* Eyebrow already conveys the 404 status in mono uppercase, so the
          decorative glyph chip is dropped in compact mode to avoid restating
          the same "404" twice on the same line. */}
      <div className="inline-flex items-center gap-2 font-mono text-[11px] tracking-widest text-fd-primary uppercase mb-5">
        <span className="size-1.5 rounded-full bg-fd-primary animate-pulse" />
        {eyebrow}
      </div>

      <h1 className="text-3xl md:text-4xl font-semibold tracking-tight leading-[1.1] mb-5">
        {title[0]}{' '}
        <span className="text-fd-primary">{title[1]}</span>
      </h1>

      <p className="text-fd-muted-foreground text-[15px] leading-relaxed mb-7">
        {subtitle}
      </p>

      <div className="flex items-center gap-3 flex-wrap">
        {ctas.map((cta) => {
          const isPrimary = (cta.variant ?? 'primary') === 'primary';
          const className = isPrimary
            ? 'group inline-flex items-center gap-1.5 rounded-md bg-fd-primary px-4 py-2 text-sm font-medium text-fd-primary-foreground hover:opacity-90 transition-opacity'
            : 'group inline-flex items-center gap-1.5 rounded-md border px-4 py-2 text-sm font-medium hover:bg-fd-muted transition-colors';
          const Icon = isPrimary ? ArrowRight : ArrowUpLeft;
          const iconClassName = isPrimary
            ? 'size-4 transition-transform group-hover:translate-x-0.5'
            : 'size-4 transition-transform group-hover:-translate-x-0.5';

          if (cta.external) {
            return (
              <a
                key={cta.href}
                href={cta.href}
                target="_blank"
                rel="noreferrer"
                className={className}
              >
                {cta.label}
                <Icon className={iconClassName} />
              </a>
            );
          }
          return (
            <Link key={cta.href} href={cta.href} className={className}>
              {cta.label}
              <Icon className={iconClassName} />
            </Link>
          );
        })}
      </div>
    </div>
  );
}
