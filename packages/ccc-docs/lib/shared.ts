export const appName = 'CCC';
export const appTagline = "CKBers' Codebase";

export const docsRoute = '/docs';
export const docsImageRoute = '/og/docs';
export const docsContentRoute = '/llms.mdx/docs';

export const gitConfig = {
  user: 'ckbfansdao', // todo: ckb-devrel
  repo: 'ccc',
  branch: 'docs/ai-optimization', // todo: master
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