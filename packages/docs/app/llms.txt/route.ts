import { siteUrl } from '@/lib/shared';
import { source } from '@/lib/source';
import { llms } from 'fumadocs-core/source';

export const revalidate = false;

const preamble = `# CCC Documentation (CKBers' Codebase)

> CCC is a monorepo-based TypeScript SDK that abstracts CKB's UTXO-based cell model into developer-friendly APIs. The system enables developers to:
> - Compose transactions using high-level abstractions like \`ccc.Transaction.from\` and automatic input/fee completion
> - Integrate wallets from Ethereum (MetaMask), Bitcoin (UniSat, Xverse), Nostr, and native CKB wallets through a unified \`Signer\` interface
> - Interact with CKB nodes via WebSocket/HTTP JSON-RPC clients
> - Build UIs using React components (\`@ckb-ccc/connector-react\`) or Web Components (\`@ckb-ccc/connector\`)
> - Develop and test using the interactive playground at live.ckbccc.com

Notes for AI agents:

- All links below are absolute URLs. Append \`.md\` to any docs page URL to get its raw Markdown version (e.g. ${siteUrl}/en/docs/getting-started/introduction.md).
- The entire documentation concatenated into a single file: ${siteUrl}/llms-full.txt
- Chinese versions of every page are available by replacing \`/en/\` with \`/zh/\` in the URL.
- API reference: https://api.ckbccc.com | Playground: https://live.ckbccc.com | Source: https://github.com/ckb-devrel/ccc
`;

export function GET() {
  const index = llms(source)
    // English only — Chinese pages are linked via the note in the preamble
    .index('en')
    // Make relative links absolute so agents can fetch them directly
    .replace(/\]\(\//g, `](${siteUrl}/`)
    // Drop the generic top-level heading; the preamble provides one
    .replace(/^# Documentation\s*\n/, '');

  return new Response(`${preamble}\n${index}`, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
    },
  });
}
