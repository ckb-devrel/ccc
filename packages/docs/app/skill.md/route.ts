import { gitConfig, siteUrl } from '@/lib/shared';

export const revalidate = false;

const repoSlug = `${gitConfig.user}/${gitConfig.repo}`;
const rawBase = `https://raw.githubusercontent.com/${repoSlug}/refs/heads/${gitConfig.branch}/skills`;

interface SkillEntry {
  name: string;
  role: 'hub' | 'spoke';
  dependsOn: string;
  summary: string;
}

// Kept in sync manually with the `skills/` directory at the repo root —
// update this list whenever a skill is added, renamed, or removed there.
const skills: SkillEntry[] = [
  {
    name: 'ckb-ccc-fundamentals',
    role: 'hub',
    dependsOn: 'none',
    summary:
      'Cell model, package selection, address handling, Shannon/CKB amount conversion, the KnownScript enum, and how to look up exact API signatures (DeepWiki/Context7/api.ckbccc.com) or navigate docs.ckbccc.com. Load this first for any CKB/CCC task.',
  },
  {
    name: 'ckb-ccc-signer-setup',
    role: 'spoke',
    dependsOn: 'ckb-ccc-fundamentals',
    summary: 'Connecting a wallet in a React/Next.js dApp, or creating a private-key Signer in a Node.js backend; the supported wallet matrix; message signing/verification.',
  },
  {
    name: 'ckb-ccc-transactions',
    role: 'spoke',
    dependsOn: 'ckb-ccc-fundamentals, ckb-ccc-signer-setup',
    summary: 'Composing and sending CKB transactions — outputs, completeInputsByCapacity/completeFeeBy ordering, cell deps, and querying the chain. The base pattern ckb-ccc-udt and ckb-ccc-spore build on.',
  },
  {
    name: 'ckb-ccc-udt',
    role: 'spoke',
    dependsOn: 'ckb-ccc-fundamentals, ckb-ccc-transactions',
    summary: 'Issuing (Single-Use-Seal), transferring, and reading metadata for UDT/xUDT fungible tokens.',
  },
  {
    name: 'ckb-ccc-spore',
    role: 'spoke',
    dependsOn: 'ckb-ccc-fundamentals, ckb-ccc-transactions',
    summary: 'Creating, transferring, and melting Spore protocol NFTs/DOBs, including cluster handling and the DOB/0 + DOB/1 content-type conventions.',
  },
  {
    name: 'ckb-ccc-playground',
    role: 'spoke',
    dependsOn: 'ckb-ccc-fundamentals, ckb-ccc-transactions',
    summary: 'The CCC Playground (live.ckbccc.com) — the @ckb-ccc/playground module, UI controls, and the two ways to share runnable code.',
  },
  {
    name: 'ckb-ccc-examples-finder',
    role: 'spoke',
    dependsOn: 'ckb-ccc-fundamentals',
    summary: 'Locating existing, ready-made CKB/CCC example code by category instead of writing something from scratch or guessing at patterns.',
  },
];

const preamble = `# CCC Agent Skills (CKB / CCC development)

> Modular, machine-readable operating guidance for AI coding assistants building on CKB with the CCC SDK. Each skill below is a directory with a SKILL.md (YAML frontmatter + Markdown body), following the Agent Skills format (https://agentskills.io/specification).

## Install

If your tool/agent can run a shell command, install with the [\`skills\` CLI](https://github.com/vercel-labs/skills) (supports Cursor, Claude Code, GitHub Copilot, Windsurf, Codex, and 60+ other agents — auto-discovers the \`skills/\` directory and writes each skill to the right path for your tool):

\`\`\`bash
npx skills add ${repoSlug}
\`\`\`

If your tool/agent can only fetch URLs (no shell access — browser-based agents, plain chat models, etc.), fetch the raw \`SKILL.md\` files directly from the table below. Always fetch \`ckb-ccc-fundamentals\` first, then the spoke skill matching the task.

## Notes for AI agents

- Always load \`ckb-ccc-fundamentals\` first — it's the hub skill; every spoke skill assumes it's already loaded.
- Then load the spoke skill(s) matching the task at hand — see the table below, or each skill's own \`description\` frontmatter field for exactly when to use it.
- Tools that natively support multiple skill files/directories (e.g. Claude Code) should fetch the whole \`skills/\` directory at once.
- Tools that only support a single rule/context file should load \`ckb-ccc-fundamentals\` as the default and fetch additional skill URLs on demand, per the task.
- Raw file URLs below always reflect the latest version on the \`${gitConfig.branch}\` branch.
- Full docs: ${siteUrl} — docs index: ${siteUrl}/llms.txt — API reference: https://api.ckbccc.com

## Skills

| Skill | Role | Depends on | SKILL.md |
| --- | --- | --- | --- |
${skills
  .map((s) => `| \`${s.name}\` | ${s.role} | ${s.dependsOn} | ${rawBase}/${s.name}/SKILL.md |`)
  .join('\n')}

## Skill summaries

${skills.map((s) => `### ${s.name}\n\n${s.summary}\n`).join('\n')}`;

export function GET() {
  return new Response(preamble, {
    headers: {
      'Content-Type': 'text/markdown; charset=utf-8',
      'Cache-Control': 'public, max-age=3600, must-revalidate',
    },
  });
}
