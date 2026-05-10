import Link from 'next/link';
import { ArrowRight, ArrowUpRight } from 'lucide-react';
import { externalLinks } from '@/lib/shared';
import { getDictionary } from '@/lib/dictionary';

// Logos live in /public/users/<slug>.svg — drop SVGs there and they'll be
// picked up automatically. PNGs work too if the path is updated below.
//
// `tone` describes the logo's intrinsic brightness so we can guarantee
// contrast across light/dark themes by inverting on the "wrong" background:
//   'dark'  — logo is mostly dark ink (good on light bg, invert in dark)
//   'light' — logo is mostly white/light (good on dark bg, invert in light)
//   'mixed' — logo carries its own colors that read on both (no invert)
const users: {
  name: string;
  url: string;
  logo: string;
  tone: 'dark' | 'light' | 'mixed';
}[] = [
  { name: 'NervDAO', url: 'https://nervdao.com/', logo: '/users/nervdao.svg', tone: 'mixed' },
  { name: 'UTXO Global', url: 'https://utxo.global/', logo: '/users/utxo-global.png', tone: 'dark' },
  { name: 'Mobit', url: 'https://mobit.app/', logo: '/users/mobit.png', tone: 'dark' },
  { name: 'Omiga', url: 'https://omiga.io/', logo: '/users/omiga.svg', tone: 'dark' },
  { name: 'Nervape', url: 'https://www.nervape.com/', logo: '/users/nervape.svg', tone: 'light' },
  { name: 'UTXOSwap', url: 'https://utxoswap.xyz/', logo: '/users/utxoswap.svg', tone: 'dark' },
  { name: 'D.ID', url: 'https://d.id/', logo: '/users/d-id.svg', tone: 'dark' },
  { name: 'Bool Network', url: 'https://bool.network/', logo: '/users/bool-network.svg', tone: 'light' },
  { name: 'World3', url: 'https://world3.ai/', logo: '/users/world3.svg', tone: 'dark' },
];

/** Tailwind classes that ensure each logo always has contrast against the
 *  current theme background by selectively inverting on the wrong tone. */
const TONE_INVERT: Record<'dark' | 'light' | 'mixed', string> = {
  // dark logo → invert only in dark mode → becomes light
  dark: 'dark:invert-50',
  // light logo → invert only in light mode → becomes dark
  light: 'invert dark:invert-0',
  // colored logo that already works on both — leave alone
  mixed: '',
};

/**
 * Syntax-highlighted code sample shown in the hero. We render tokens as spans
 * instead of pulling in a full highlighter — the content is static so a
 * handful of classes is lighter than shipping shiki to the landing page.
 */
function HeroCode() {
  // Tailwind token classes tuned to read well on both light and dark backdrops.
  const kw = 'text-[oklch(0.72_0.12_310)]'; // keyword
  const fn = 'text-[oklch(0.72_0.15_226)]'; // function / type
  const str = 'text-[oklch(0.72_0.14_145)]'; // string
  const cmt = 'text-fd-muted-foreground italic';

  return (
    <pre className="font-mono text-[12.5px] leading-[1.75] px-5 py-5 overflow-x-auto text-fd-foreground/90">
      <code>
        <span className={cmt}>// Describe the outputs you want</span>
        {'\n'}
        <span className={kw}>const</span> tx = ccc.<span className={fn}>Transaction</span>.
        <span className={fn}>from</span>({'{'}
        {'\n'}  outputs: [{'{'} lock: toLock, capacity: ccc.
        <span className={fn}>fixedPointFrom</span>(<span className={str}>&quot;100&quot;</span>) {'}'}],
        {'\n'}
        {'}'});{'\n'}
        {'\n'}
        <span className={cmt}>// CCC fills inputs &amp; fee automatically</span>
        {'\n'}
        <span className={kw}>await</span> tx.<span className={fn}>completeInputsByCapacity</span>(signer);
        {'\n'}
        <span className={kw}>await</span> tx.<span className={fn}>completeFeeBy</span>(signer);
        {'\n'}
        {'\n'}
        <span className={kw}>const</span> txHash = <span className={kw}>await</span> signer.
        <span className={fn}>sendTransaction</span>(tx);
      </code>
    </pre>
  );
}

export default async function HomePage({ params }: PageProps<'/[lang]'>) {
  const { lang } = await params;
  const t = getDictionary(lang).home;

  return (
    <main className="flex flex-1 flex-col">
      {/* ----------------------------------------------------------------
       * Hero — editorial headline + real CCC code preview.
       * A quiet radial-faded dot grid provides technical texture without
       * resorting to a loud UI-framework gradient.
       * ---------------------------------------------------------------- */}
      <section className="relative border-b border-hairline overflow-hidden">
        <div
          aria-hidden
          className="absolute inset-0 -z-10 bg-grid text-fd-muted-foreground/25 mask-radial-fade"
        />
        <div className="mx-auto w-full max-w-6xl px-6 py-20 md:py-28 grid gap-14 md:grid-cols-5 md:items-center">
          {/* Left column — copy */}
          <div className="md:col-span-3">
            <div className="inline-flex items-center gap-2 font-mono text-[11px] tracking-widest text-fd-primary uppercase mb-5">
              <span className="size-1.5 rounded-full bg-fd-primary animate-pulse" />
              {t.eyebrow}
            </div>
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-semibold tracking-tight leading-[1.05] mb-6">
              {t.title[0]}
              <br />
              <span className="text-fd-primary">{t.title[1]}</span>
            </h1>
            <p className="text-fd-muted-foreground text-base md:text-lg leading-relaxed max-w-xl mb-8">
              {t.subtitle}
            </p>
            <div className="flex items-center gap-3 flex-wrap mb-7">
              <Link
                href={`/${lang}/docs`}
                className="group inline-flex items-center gap-1.5 rounded-md bg-fd-primary px-4 py-2.5 text-sm font-medium text-fd-primary-foreground hover:opacity-90 transition-opacity"
              >
                {t.ctaDocs}
                <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
              </Link>
              <a
                href={externalLinks.playground}
                target="_blank"
                rel="noreferrer"
                className="group inline-flex items-center gap-1.5 rounded-md border px-4 py-2.5 text-sm font-medium hover:bg-fd-muted transition-colors"
              >
                {t.ctaPlayground}
                <ArrowUpRight className="size-4 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
              </a>
            </div>
            {/* Install hint — tiny but unmistakably dev-tool. */}
            <div className="inline-flex items-center gap-2 font-mono text-xs text-fd-muted-foreground border-l-2 border-fd-primary/40 pl-3 py-0.5">
              {t.installHint}
            </div>
          </div>

          {/* Right column — code preview. Raised slightly with a tinted halo
             instead of a real drop shadow, which reads cleaner. */}
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
                  {t.codeCaption}
                </span>
              </div>
              <HeroCode />
            </div>
          </div>
        </div>
      </section>

      {/* ----------------------------------------------------------------
       * Capabilities — 3-column grid bordered like a spec sheet rather
       * than a row of soft rounded cards.
       * ---------------------------------------------------------------- */}
      <section className="border-b border-hairline">
        <div className="mx-auto w-full max-w-6xl px-6 py-20 md:py-24">
          <div className="mb-14 flex items-end justify-between gap-6 flex-wrap">
            <div>
              <p className="font-mono text-[11px] tracking-widest uppercase text-fd-muted-foreground mb-3">
                // {t.sectionFeatures}
              </p>
              <h2 className="text-3xl md:text-4xl font-semibold tracking-tight max-w-2xl leading-tight">
                {t.featuresTitle}
              </h2>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 border-t border-l border-hairline">
            {t.features.map((f, i) => (
              <div
                key={f.title}
                className="group relative p-6 md:p-7 border-b border-r border-hairline hover:bg-fd-muted/30 transition-colors"
              >
                <div className="font-mono text-[11px] tracking-widest text-fd-primary mb-4">
                  {String(i + 1).padStart(2, '0')}
                </div>
                <h3 className="font-semibold text-base mb-2 tracking-tight">
                  {f.title}
                </h3>
                <p className="text-fd-muted-foreground text-[14px] leading-relaxed">
                  {f.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ----------------------------------------------------------------
       * Ecosystem — grid of project logos. Default monochrome reads as an
       * editorial sponsor wall; on hover each tile blooms into color with a
       * radial brand glow, lifts a hair, and reveals an external-link mark.
       * A faint per-tile breathing animation (staggered phase) keeps the
       * section alive without screaming.
       * ---------------------------------------------------------------- */}
      <section className="relative border-b border-hairline overflow-hidden">
        {/* Quiet grid texture, masked to fade at edges — same visual vocabulary as the hero. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-grid text-fd-border/30 mask-radial-fade"
        />
        <div className="relative mx-auto w-full max-w-6xl px-6 py-20">
          <div className="flex items-baseline justify-between mb-10 gap-4 flex-wrap">
            <p className="font-mono text-[11px] tracking-widest uppercase text-fd-muted-foreground">
              // {t.sectionUsers}
            </p>
            <h2 className="text-xl md:text-2xl font-medium tracking-tight text-fd-muted-foreground">
              {t.usersTitle}
            </h2>
          </div>
          <ul className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-px bg-fd-border/40 border border-hairline rounded-lg overflow-hidden">
            {users.map((u, i) => (
              <li key={u.name} className="contents">
                <a
                  href={u.url}
                  target="_blank"
                  rel="noreferrer"
                  title={u.name}
                  style={{ animationDelay: `${(i % 5) * 0.8}s` }}
                  className="user-tile group relative flex h-28 md:h-32 items-center justify-center bg-fd-background overflow-hidden transition-colors duration-300 hover:bg-fd-card"
                >
                  {/* Radial brand glow — masked behind the logo, reveals on hover. */}
                  <span
                    aria-hidden
                    className="pointer-events-none absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500"
                    style={{
                      background:
                        'radial-gradient(circle at center, color-mix(in oklch, var(--ccc-brand) 22%, transparent) 0%, transparent 65%)',
                    }}
                  />
                  {/* Logo — grayscale + dim by default, full color on hover. */}
                  <img
                    src={u.logo}
                    alt={u.name}
                    loading="lazy"
                    className={`relative max-h-10 md:max-h-12 max-w-[60%] w-auto object-contain grayscale opacity-55 transition-all duration-500 ease-out group-hover:grayscale-0 group-hover:opacity-100 group-hover:scale-105 ${TONE_INVERT[u.tone]}`}
                  />
                  {/* Name label — sits below logo, fades in on hover. */}
                  <span className="absolute bottom-2 left-1/2 -translate-x-1/2 font-mono text-[10px] tracking-widest uppercase text-fd-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity duration-300 whitespace-nowrap">
                    {u.name}
                  </span>
                  {/* External link mark — top-right, fades in on hover. */}
                  <ArrowUpRight className="absolute top-2.5 right-2.5 size-3.5 text-fd-primary opacity-0 -translate-x-1 translate-y-1 group-hover:opacity-100 group-hover:translate-x-0 group-hover:translate-y-0 transition-all duration-300" />
                  {/* Brand-tinted border highlight on hover. */}
                  <span
                    aria-hidden
                    className="pointer-events-none absolute inset-0 ring-1 ring-inset ring-transparent group-hover:ring-fd-primary/40 transition-[box-shadow,--tw-ring-color] duration-300"
                  />
                </a>
              </li>
            ))}
          </ul>
          {/* Subtle footer mark — invites readers to add their project. */}
          <div className="mt-6 flex justify-end">
            <a
              href={externalLinks.github}
              target="_blank"
              rel="noreferrer"
              className="font-mono text-[11px] tracking-widest uppercase text-fd-muted-foreground hover:text-fd-foreground transition-colors inline-flex items-center gap-1.5"
            >
              {t.usersMore} <ArrowUpRight className="size-3" />
            </a>
          </div>
        </div>
      </section>
    </main>
  );
}
