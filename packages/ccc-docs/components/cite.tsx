import * as React from 'react';
import { defaultCiteRepo, defaultCiteBranch } from '@/lib/shared';

/**
 * <Cite /> — inline source-code citation chip.
 *
 * Renders a compact, monospace chip that links to a file on GitHub at a
 * specific line range. Designed for DeepWiki-style references embedded in
 * docs prose, e.g.:
 *
 *   <cite repo="ckb-devrel/ccc" path="packages/ccc/src/signersController.ts"
 *         start="155" end="160" />
 *
 * Visually it sits like an inline code chip — small, monospace, hairline
 * border, brand-tinted line numbers — so it adds verifiable provenance to
 * a sentence without disrupting the reading rhythm.
 *
 * Both `<cite ...>` (lowercase, matches the markdown the user has been
 * pasting) and `<Cite ...>` are wired through `getMDXComponents`. When the
 * required `repo` + `path` props are missing, the component falls back to
 * the plain HTML <cite> element so semantic citations elsewhere still work.
 */

export interface CiteProps {
  /** GitHub repo in `owner/repo` form. */
  repo?: string;
  /** Path to the file inside the repo. */
  path?: string;
  /** First line number of the cited range (1-indexed). */
  start?: string | number;
  /** Last line number (inclusive). Defaults to `start` for single lines. */
  end?: string | number;
  /** Branch / tag / commit-ish. Defaults to `master`. */
  branch?: string;
  /** Optional override of the visible file label. */
  label?: string;
  /** Children — used only when falling back to plain <cite>. */
  children?: React.ReactNode;
  /** Forwarded to the rendered anchor for one-off styling. */
  className?: string;
}

export function Cite({
  repo = defaultCiteRepo,
  path,
  start,
  end,
  branch = defaultCiteBranch,
  label,
  children,
  className,
  ...rest
}: CiteProps & Omit<React.HTMLAttributes<HTMLElement>, keyof CiteProps>) {
  // Fallback: behave like the native <cite> element when the path is missing
  // (e.g. semantic HTML use). `repo` always defaults to the project repo.
  if (!path) {
    return <cite {...rest}>{children}</cite>;
  }

  const startNum = start != null ? String(start) : null;
  const endNum = end != null ? String(end) : null;
  const hasRange = startNum !== null;
  const isSingle = !endNum || endNum === startNum;

  // GitHub uses `#L155-L160` for ranges, `#L155` for single lines.
  const hash = !hasRange
    ? ''
    : isSingle
      ? `#L${startNum}`
      : `#L${startNum}-L${endNum}`;

  const href = `https://github.com/${repo}/blob/${branch}/${path}${hash}`;

  // The visible label: file name (last segment) — keeps the chip narrow.
  // Full repo + path goes into the tooltip for the curious reader.
  const fileLabel = label ?? path.split('/').pop() ?? path;

  const lineLabel = !hasRange
    ? null
    : isSingle
      ? `L${startNum}`
      : `L${startNum}–${endNum}`;

  const tooltip = `${repo}/${path}${
    hasRange ? `:${startNum}${isSingle ? '' : `-${endNum}`}` : ''
  }`;

  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer noopener"
      title={tooltip}
      // `not-prose` keeps fumadocs prose styles from re-decorating the link.
      // Sizing is intentionally tiny — this is a footnote, not a CTA.
      className={[
        'not-prose inline-flex items-baseline gap-1 align-baseline mx-0.5',
        'px-1.5 py-0.5 rounded-sm border border-hairline',
        'bg-fd-muted/40 text-fd-muted-foreground',
        'font-mono text-[10.5px] leading-none whitespace-nowrap no-underline',
        'transition-colors',
        'hover:text-fd-primary hover:border-fd-primary/40 hover:bg-fd-primary/5',
        'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-fd-primary/50',
        className ?? '',
      ].join(' ')}
    >
      <span className="opacity-70">{fileLabel}</span>
      {lineLabel && (
        <span className="text-fd-primary/80 tracking-tight">{lineLabel}</span>
      )}
    </a>
  );
}
