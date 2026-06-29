<p align="center">
  <a href="https://docs.ckbccc.com/">
    <img alt="Logo" src="https://raw.githubusercontent.com/ckb-devrel/ccc/master/assets/logoAndText.svg" style="height: 8rem; max-width: 90%; padding: 0.5rem 0;" />
  </a>
</p>

<h1 align="center" style="font-size: 48px;">
  CCC Docs
</h1>

<p align="center">
  <img alt="GitHub commit activity" src="https://img.shields.io/github/commit-activity/m/ckb-devrel/ccc" />
  <img alt="GitHub last commit" src="https://img.shields.io/github/last-commit/ckb-devrel/ccc/master" />
  <a href="https://docs.ckbccc.com/"><img
    alt="Docs" src="https://img.shields.io/website?url=https%3A%2F%2Fdocs.ckbccc.com%2F&label=Docs"
  /></a>
</p>

<p align="center">
  The documentation site for CCC — CKBers' Codebase.
  <br />
  Built with <a href="https://nextjs.org/">Next.js</a> and <a href="https://fumadocs.dev/">Fumadocs</a>, deployed at <a href="https://docs.ckbccc.com/">docs.ckbccc.com</a>.
</p>

## Features

- **i18n** — English and Chinese with per-route translations
- **Full-text search** — powered by [Orama](https://orama.com/) with CJK tokenizer support
- **LLM-friendly** — serves `llms.txt` and `llms-full.txt` for AI consumption
- **Mermaid diagrams** — rendered via remark plugin with click-to-zoom modal

## Project Structure

| Path | Description |
| --- | --- |
| `content/docs/` | Documentation pages (MDX) |
| `app/[lang]/(home)/` | Landing page |
| `app/[lang]/docs/` | Documentation layout and pages |
| `app/api/search/` | Search API route |
| `lib/source.ts` | Content source adapter |
| `source.config.ts` | Fumadocs MDX configuration |

## AI / LLM Integration

This site is designed to be machine-readable. AI agents, MCP tools, and other automated consumers can access documentation content via the following endpoints:

| Endpoint | Description |
| --- | --- |
| [`/llms.txt`](https://docs.ckbccc.com/llms.txt) | Site index in plain text — lists all available doc pages with titles and URLs |
| [`/llms-full.txt`](https://docs.ckbccc.com/llms-full.txt) | Full concatenated content of all doc pages in plain text |
| `/{lang}/docs/{path}.md` | Append `.md` to any doc page URL to get its raw Markdown content |
| `/{lang}/docs/{path}.mdx` | Same as above, `.mdx` extension also works |

### Examples

```bash
# Get the site-wide doc index
curl https://docs.ckbccc.com/llms.txt

# Get all docs as a single text file (suitable for embedding / RAG)
curl https://docs.ckbccc.com/llms-full.txt

# Get raw Markdown for a specific page
curl https://docs.ckbccc.com/en/docs/getting-started/quick-start.md

# Get the Chinese version
curl https://docs.ckbccc.com/zh/docs/getting-started/quick-start.md
```

These endpoints return plain text (`text/plain` or `text/markdown`) with UTF-8 encoding, making them easy to consume without HTML parsing.

## Development

```bash
pnpm dev
```

Open http://localhost:3000 with your browser to see the result.

## Learn More

- [Fumadocs](https://fumadocs.dev) — the documentation framework
- [Next.js Documentation](https://nextjs.org/docs) — learn about Next.js

<h3 align="center">
  Read more about CCC on <a href="https://docs.ckbccc.com">our website</a> or <a href="https://github.com/ckb-devrel/ccc">GitHub Repo</a>.
</h3>
