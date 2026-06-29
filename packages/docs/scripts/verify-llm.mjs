// Verifies the docs site's AI-facing endpoints:
//   - /llms.txt and /llms-full.txt exist and are well-formed
//   - the sitemap advertises them
//   - per-page raw Markdown (.md) is clean (no leaked MDX imports)
//   - `Accept: text/markdown` content negotiation serves Markdown, not HTML
//   - every internal link listed in /llms.txt resolves
//
// Usage:
//   node scripts/verify-llm.mjs                                   # spawns `next start` (needs a prior build)
//   BASE_URL=http://localhost:3000 node scripts/verify-llm.mjs    # test an already-running server
//   BASE_URL=https://docs.ckbccc.com node scripts/verify-llm.mjs  # test production
//
// Exits non-zero if any check fails, so it can gate CI.

import { spawn } from 'node:child_process';

const PORT = Number(process.env.PORT ?? 3000);
const EXTERNAL_BASE = process.env.BASE_URL;
const BASE = EXTERNAL_BASE ?? `http://localhost:${PORT}`;

// llms.txt links use the production origin; rewrite it to the origin under test.
const CANONICAL = 'https://docs.ckbccc.com';
// A docs page known to exist, used for the per-page Markdown checks.
const SAMPLE_DOC = '/en/docs/packages/core-packages/core';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const failures = [];
function check(name, ok, detail = '') {
  const label = detail ? `${name} — ${detail}` : name;
  if (ok) {
    console.log(`  ok  ${name}`);
  } else {
    failures.push(label);
    console.error(`FAIL  ${label}`);
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function toUrl(path) {
  return path.startsWith('http') ? path : `${BASE}${path}`;
}

async function fetchText(path, init) {
  const res = await fetch(toUrl(path), init);
  return { res, body: await res.text() };
}

async function waitForServer(timeoutMs = 60_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      if ((await fetch(`${BASE}/llms.txt`)).ok) return;
    } catch {
      // server not up yet
    }
    await sleep(1000);
  }
  throw new Error(`Server at ${BASE} did not become ready in time`);
}

// ---------------------------------------------------------------------------
// Checks
// ---------------------------------------------------------------------------

// Returns the /llms.txt body so the link check can reuse it.
async function checkLlmsIndex() {
  const { res, body } = await fetchText('/llms.txt');
  check('/llms.txt returns 200', res.status === 200, `status ${res.status}`);
  check('/llms.txt has preamble heading', body.includes('# CCC Documentation'));
  check('/llms.txt has task-oriented section', body.includes('## Common tasks'));
  return body;
}

async function checkLlmsFull() {
  const { res, body } = await fetchText('/llms-full.txt');
  check('/llms-full.txt returns 200', res.status === 200, `status ${res.status}`);
  check('/llms-full.txt is non-trivial', body.length > 1000, `${body.length} chars`);
}

async function checkSitemap() {
  const { body } = await fetchText('/sitemap.xml');
  check('sitemap lists /llms.txt', body.includes('/llms.txt'));
  check('sitemap lists /llms-full.txt', body.includes('/llms-full.txt'));
}

// Leaked MDX component imports look like `import {...} from '@/components/...'`.
// Example code blocks (e.g. `import { ccc } from "@ckb-ccc/core"`) are fine.
const LEAKED_MDX_IMPORT = /^import\b[^\n]*\bfrom\s+['"]@\//m;

async function checkSampleMarkdown() {
  const { res, body } = await fetchText(`${SAMPLE_DOC}.md`);
  const contentType = res.headers.get('content-type') ?? '';
  check('sample .md returns 200', res.status === 200, `status ${res.status}`);
  check('sample .md is text/markdown', contentType.includes('markdown'), contentType || 'no content-type');
  check('sample .md has no leaked MDX component imports', !LEAKED_MDX_IMPORT.test(body));
}

// proxy.ts rewrites a docs HTML URL to its Markdown route when the client
// prefers Markdown, so AI agents get clean text from the canonical page URL.
async function checkMarkdownNegotiation() {
  const { res, body } = await fetchText(SAMPLE_DOC, { headers: { Accept: 'text/markdown' } });
  const contentType = res.headers.get('content-type') ?? '';
  check('Accept: text/markdown returns 200', res.status === 200, `status ${res.status}`);
  check(
    'Accept: text/markdown serves Markdown, not HTML',
    contentType.includes('markdown') && !body.trimStart().startsWith('<'),
    contentType || 'no content-type',
  );
}

// Bounded concurrency + retries with backoff: dev servers compile routes on
// demand and can stall under a parallel burst; `next start` (the CI path)
// serves prebuilt pages instantly.
const CONCURRENCY = 4;
const ATTEMPTS = 4;

async function probe(href) {
  let lastErr = '';
  for (let attempt = 0; attempt < ATTEMPTS; attempt += 1) {
    try {
      const res = await fetch(toUrl(href.replace(CANONICAL, BASE)), { redirect: 'follow' });
      // Consume the response body to prevent socket leaks in Node.js
      await res.text();
      if (res.ok) return true;
      lastErr = `status ${res.status}`;
    } catch (err) {
      lastErr = String(err);
    }
    await sleep((attempt + 1) * 1000);
  }
  console.error(`      broken link: ${href} (${lastErr})`);
  return false;
}

// Only probe links on our own origin; external links (github.com, ...) are
// skipped so CI stays hermetic — no network or deployment required.
async function checkInternalLinks(llmsBody) {
  console.log('  --- Checking internal Markdown links...');
  const links = [...new Set([...llmsBody.matchAll(/\]\((https?:\/\/[^)]+)\)/g)].map((m) => m[1]))];
  const internal = links.filter((href) => href.startsWith(CANONICAL)).map((href) => `${href}.md`);
  const externalCount = links.length - internal.length;
  if (externalCount > 0) {
    console.log(`  ..  skipping ${externalCount} external link(s) (not verified in CI)`);
  }

  let broken = 0;
  for (let i = 0; i < internal.length; i += CONCURRENCY) {
    const batch = internal.slice(i, i + CONCURRENCY);
    const results = await Promise.all(batch.map(probe));
    batch.forEach((href, idx) => {
      const path = href.replace(CANONICAL, '');
      if (results[idx]) {
        console.log(`  ok  ${path}`);
      } else {
        console.log(`  FAIL ${path}`);
        broken += 1;
      }
    });
  }
  check(`all ${internal.length} internal llms.txt links resolve`, broken === 0, `${broken} broken`);
}

// ---------------------------------------------------------------------------
// Runner
// ---------------------------------------------------------------------------

async function run() {
  const llmsBody = await checkLlmsIndex();
  await checkLlmsFull();
  await checkSitemap();
  await checkSampleMarkdown();
  await checkMarkdownNegotiation();
  await checkInternalLinks(llmsBody);
}

let child;
try {
  if (!EXTERNAL_BASE) {
    child = spawn('pnpm', ['exec', 'next', 'start', '-p', String(PORT)], {
      stdio: ['ignore', 'inherit', 'inherit'],
    });
    await waitForServer();
  }
  await run();
} catch (err) {
  console.error(err);
  failures.push(String(err));
} finally {
  child?.kill('SIGTERM');
}

if (failures.length > 0) {
  console.error(`\n${failures.length} check(s) failed.`);
  process.exit(1);
}
console.log('\nAll AI-endpoint checks passed.');
