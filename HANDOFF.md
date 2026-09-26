# Labbai — handoff (2026-09-26)

Read `LABBAI_PLAN.md` first: it is the source of truth for every product decision.
This file is the operational state for whoever continues the work.

## What Labbai is

Fork of Sim v0.8.59 (simstudioai/sim, Apache-2.0) + Arena's local AI copilot
(`apps/sim/local-copilot`), rebranded later as Labbai. We do NOT sync with upstream Sim.
Owner wants: **cleanup only for now, no new features**, then the owner tests it.

## Branches

- `main` — all cleanup steps done (see table). CI: tsc clean, whole vitest suite green (35 717 tests), next build OK; deployed to the test server 2026-09-26.
- `wip/ee-cleanup`, `claude/peaceful-maxwell-vbuk8b` — merged into `main`; can be deleted.
- `ci-reports`, `ci-build-report` — written by CI (see below). `arena-base` — old Arena code backup.

## Cleanup status (see LABBAI_PLAN.md "Order of work")

| Step | Status |
|---|---|
| 1 Docs, landing, desktop, CLI/SDK, helm, PII, sandboxes (JS-only Function), Pi/A2A/Mothership/video blocks, enrichments, Sim Mailer | done |
| 2 Integrations trimmed to ~10% (list in LABBAI_PLAN.md) | done |
| 3 Stripe and all payments removed; entitlements permissive; cost ledger kept | done |
| 4 LLM: OpenAI only (gpt-5.5, gpt-5-mini default, gpt-4.1, gpt-4.1-mini, text-embedding-3-small); `OPENAI_BASE_URL` / `OPENAI_EXTRA_HEADERS` for a later Cloudflare switch | done |
| 6 Remove `apps/sim/ee`; access control, audit logs, credential groups, access requests, SCIM re-implemented clean-room (`lib/labbai/**`), always on | done |
| 7 Organization UI layer (`/o/**`), Sim Search, org Search MCP, org Assistant removed; kept org-backed features live in workspace settings; DB tables kept | done |
| + Sim cloud copilot path (Go mothership client, BYOK/API-key routes) and Local/Cloud switch removed — local copilot only | done |
| + Telemetry only to our own `TELEMETRY_ENDPOINT`; off when unset | done |

LICENSE RULE (critical): `apps/sim/ee` was under the Sim Enterprise License. Never read,
copy or restore `ee` source from git history. Requirements come only from Apache code.

### Known leftovers (harmless, optional follow-ups)

- Unreachable assistant/org branches: `requestMode === 'assistant'` in `tools/index.ts`,
  `executor/utils/credential-token.ts`, `application-delegation.ts`, org plumbing in
  `lib/copilot/request/lifecycle/{start,run}.ts`, `chat-status.ts` org owner.
- Dead `storageNotification` variables in `lib/knowledge/{connectors/detachment,orchestration/connectors,documents/service}.ts`.
- Empty loop in `lib/workspaces/organization-workspaces.ts` (Stripe leftover).
- `fileId` selector-context key no kept block supplies; Slack trigger routing in
  `lib/workflows/sanitization/json-sanitizer.ts`; connect-OAuth modal "OAuth app configuration" fields (QuickBooks-only).
- `cleanupSourceOrganizationArtifactsTx` keeps an unused `sourceOrganizationId` param.
- Biome issues that need `--unsafe` (unused imports, class sorting): `bunx biome check apps/sim packages`.

## How to verify (no local builds — the owner's Mac has 8 GB)

CI on every push to `main` (`.github/workflows/typecheck.yml`):
1. `bun install --frozen-lockfile` → `tsc --noEmit` (apps/sim) → vitest (local copilot +
   a few suites) → whole apps/sim vitest suite → results pushed to
   branch `ci-reports`:
   `https://raw.githubusercontent.com/azizmubashirov/labbai-sim/ci-reports/{status,typecheck,tests,full-tests,full-tests-failed,install}.txt`
2. `next build` job → `ci-build-report` branch (`status.txt`, `build.txt`).
3. `Build images` (`.github/workflows/build-images.yml`) runs only after the type-check
   workflow succeeds on `main` → pushes `ghcr.io/azizmubashirov/labbai-sim-{simstudio,realtime,migrations,cron}:latest`.

Job logs need repo-admin auth; the report branches exist so results are readable publicly.
To test a WIP branch in CI, merge it to `main` only when it type-checks, or temporarily
add the branch to the workflow `on.push.branches`.

`bun.lock` must be regenerated whenever a package.json changes (CI uses
`--frozen-lockfile`). With Docker: copy all package.json files + bun.lock + bunfig.toml +
patches/ into an empty dir and run
`docker run --rm -v $PWD:/w -w /w oven/bun:1.4.1-alpine bun install --lockfile-only`.

## Test server

- Host `147.93.62.159` (ssh alias `hostinger-root`), stack in `/root/labbai/arena`
  (`docker-compose.labbai.yml` from this repo, fresh DB volume `labbai_pg_v2`).
- Deploy: `sh /root/labbai/deploy-labbai.sh` (pull GHCR images, migrate, up).
- App bound to 127.0.0.1 only: `ssh -f -N -L 3300:127.0.0.1:3300 -L 3302:127.0.0.1:3302 hostinger-root`
  then open http://localhost:3300.
- Server `.env` has OPENAI_API_KEY, COPILOT_PROVIDER=openai, COPILOT_MODEL=gpt-5.5,
  NEXT_PUBLIC_PLATFORM_LLM_PROVIDERS=openai. Never paste secrets into chat or commits.
- The server is too weak to build images — always build in GitHub Actions.

## Known open issues (not cleanup)

Listed in LABBAI_PLAN.md "Open issues found in testing" (Google OAuth client, secret
rotation, file preview tool name, copilot enum reuse for model ids, etc.).
