export const appName = 'CCC';
export const appTagline = "CKBers' Codebase";

/** Canonical site origin, used for sitemap, robots.txt and llms.txt absolute URLs. */
export const siteUrl = 'https://docs.ckbccc.com';

/**
 * Note embedded in every per-page Markdown output so AI agents landing on a
 * single page can discover the full documentation index (Mintlify-style).
 */
export const docsIndexNote = `> ## Documentation Index
> Fetch the complete documentation index at: ${siteUrl}/llms.txt - append ".md" to any page URL for its Markdown source.
> Use this file to discover all available pages before exploring further.`;

export const docsRoute = '/docs';
export const docsImageRoute = '/og/docs';
export const docsContentRoute = '/llms.mdx/docs';

export const gitConfig = {
  user: 'ckb-devrel',
  repo: 'ccc',
  branch: 'master',
};

export const externalLinks = {
  playground: 'https://live.ckbccc.com',
  api: 'https://api.ckbccc.com',
  github: `https://github.com/${gitConfig.user}/${gitConfig.repo}`,
  githubOrg: 'https://github.com/ckb-devrel',
  twitter: 'https://x.com/CKBDevrel',
  demo: 'https://app.ckbccc.com',
  talk: 'https://talk.nervos.org',
};

/** One-liner shown in the footer / brand spots. */
export const appSlogan = 'Build trust for developer';

/**
 * Default `repo` for <Cite /> source-code references in MDX. Lets authors
 * write `<Cite path="..." start="..." />` without repeating the repo on
 * every citation. Override per-call by passing an explicit `repo` prop.
 */
export const defaultCiteRepo = 'ckb-devrel/ccc';

/** Default branch used by <Cite /> when none is specified. */
export const defaultCiteBranch = 'master';