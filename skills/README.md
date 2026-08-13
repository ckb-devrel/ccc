# CCC Agent Skills — Maintenance

This directory holds the [Agent Skills](https://agentskills.io/specification) that teach AI coding assistants how to build on CKB with the CCC SDK: one hub skill (`ckb-ccc-fundamentals`) plus a spoke skill per task area (`ckb-ccc-signer-setup`, `ckb-ccc-transactions`, `ckb-ccc-udt`, `ckb-ccc-spore`, `ckb-ccc-playground`, `ckb-ccc-examples-finder`).

They're consumed two ways:
- Directly from this repo via [`npx skills add ckb-devrel/ccc`](https://github.com/vercel-labs/skills), which tracks installs in the consumer's `skills-lock.json` and can later `npx skills check` / `npx skills update` against whatever's on `master`.
- As raw `SKILL.md` URLs, listed at [docs.ckbccc.com/skill.md](https://docs.ckbccc.com/skill.md), for agents that can only fetch URLs.

Both paths mean **anyone with an existing install only sees your changes after they explicitly re-check/update** — there's no push notification. The one signal they have is the `metadata.version` field in each skill's frontmatter, so it has to be kept honest.

## When you edit a `SKILL.md`

1. **Bump `metadata.version`** in that skill's frontmatter — every time, even for small wording fixes. Use semver:
   - **patch** (`1.0.0` → `1.0.1`): wording/clarity fixes, no behavior change.
   - **minor** (`1.0.0` → `1.1.0`): new guidance added, existing guidance unchanged.
   - **major** (`1.0.0` → `2.0.0`): a previous instruction was wrong and is being corrected/reversed — this is the case most worth calling out in the PR description, since an agent that already loaded the old version may be acting on bad guidance.
2. **Keep `docs.ckbccc.com/skill.md`'s skill table in sync** if you add, remove, or rename a skill, or change its `role`/`depends-on` — it's maintained by hand in `packages/docs/app/skill.md/route.ts`, not generated from this directory.
3. **Don't rely on `npx skills update` alone to signal urgency.** It's a pull-based content-hash diff, not a version check, and has known reliability gaps (e.g. [vercel-labs/skills#484](https://github.com/vercel-labs/skills/issues/484) — sometimes reports "up to date" when the remote has changed). For a correction significant enough that stale guidance would actively mislead an agent (a major bump), call it out in the PR/release notes so it's not silently missed.

## Verifying a change

There's no automated eval suite for these skills yet. At minimum, re-run the canary questions in [Verify & Troubleshoot](https://docs.ckbccc.com/en/docs/ai-resources/verify-and-troubleshoot) against a tool with the updated skill loaded, and confirm the answer reflects your change.
