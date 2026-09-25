# Labbai — handoff (2026-09-25)

Read `LABBAI_PLAN.md` first: it is the source of truth for every product decision.
This file is the operational state for whoever continues the work.

## What Labbai is

Fork of Sim v0.8.59 (simstudioai/sim, Apache-2.0) + Arena's local AI copilot
(`apps/sim/local-copilot`), rebranded later as Labbai. We do NOT sync with upstream Sim.
Owner wants: **cleanup only for now, no new features**, then the owner tests it.

## Branches

- `main` — last green state: cleanup steps 1–4 done, type-check + tests + next build pass,
  deployed to the test server.
- `wip/ee-cleanup` — step 6 (remove `apps/sim/ee`) **in progress, does not compile yet**.
- `ci-reports`, `ci-build-report` — written by CI (see below). `arena-base` — old Arena code backup.

## Cleanup status (see LABBAI_PLAN.md "Order of work")

| Step | Status |
|---|---|
| 1 Docs, landing, desktop, CLI/SDK, helm, PII, sandboxes (JS-only Function), Pi/A2A/Mothership/video blocks, enrichments, Sim Mailer | done (main) |
| 2 Integrations trimmed to ~10% (list in LABBAI_PLAN.md) | done (main) |
| 3 Stripe and all payments removed; entitlements permissive; cost ledger kept | done (main) |
| 4 LLM: OpenAI only (gpt-5.5, gpt-5-mini default, gpt-4.1, gpt-4.1-mini, text-embedding-3-small); `OPENAI_BASE_URL` / `OPENAI_EXTRA_HEADERS` for a later Cloudflare switch | done (main) |
| 6 Remove `apps/sim/ee`, re-implement kept features clean-room | **in progress on `wip/ee-cleanup`** |
| 7 Remove organization UI layer (`/o/[organizationId]`), keep DB tables | todo |
| + Remove Sim cloud copilot path (Go mothership client, `app/api/copilot/byok/**`) and the Local/Cloud switch — local copilot only | todo |
| + Telemetry → our own endpoint (`TELEMETRY_ENDPOINT`), never telemetry.simstudio.ai | todo |

### Step 6 details (wip/ee-cleanup)

LICENSE RULE (critical): `apps/sim/ee` is under the Sim Enterprise License. Never read,
copy or port `ee` source (it is already deleted on the WIP branch — do not restore it from
git history to look at it). Requirements come only from Apache code: call sites, the
`packages/db` schema, API contracts, `packages/audit`, `packages/platform-authz`.

Done on the branch:
- Workspace forking removed.
- Access control / permission groups re-implemented: `lib/labbai/access-control/*`,
  `hooks/queries/permission-groups.ts`, `components/settings/access-control/*`.
- Activity log (audit logs) + credential groups UI re-implemented:
  `components/settings/audit-logs/*`, `components/settings/credential-groups/*`,
  `hooks/queries/audit-logs.ts`; credential groups always on (no enterprise gate/env).
- SSO, whitelabeling, session policy removed; branding is static (`lib/branding/index.ts`).

Possibly unfinished (helpers were stopped / may have been mid-edit — verify each):
- Access requests re-implementation.
- SCIM re-implementation (`components/settings/organization-security.tsx` still imported ee).
- Removal of data retention, data drains, custom blocks, organization usage/search stats.

Leftover TODOs reported by helpers:
- Navigation (`components/settings/navigation.ts` + tests): remove section ids `forks`,
  `sso` (and `/o` `domains`→`sso` alias), `whitelabeling`; update
  `ENTERPRISE_GATED_SECTION_LABELS` in `lib/workspaces/admin-move-source-impact.ts`,
  `settings/[section]/page.test.tsx`.
- `deployment-shape.ts`: remove `features.sso/whitelabeling/sessionPolicies` (+ test fixtures
  in `settings-sidebar.test.tsx`, `workspace-section-access.test.ts`).
- `env-flags.ts` + `packages/testing/src/mocks/env-flags.mock.ts`: remove `isForkingEnabled`,
  `isSsoEnabled`, `isWhitelabelingEnabled`, `isSessionPoliciesEnabled` (and other removed
  ee flags); kept features must be always on (no enterprise flag/plan checks).
- `env.ts` / `.env.example`: remove `FORKING_ENABLED`, `SSO_*` (incl. `SSO_MAPPING_*`,
  `SSO_OIDC_*`, `SSO_SAML_*`), `WHITELABELING_ENABLED`, `SESSION_POLICIES_ENABLED` (+ their
  `NEXT_PUBLIC_` variants), `NEXT_PUBLIC_BRAND_*`, `NEXT_PUBLIC_CUSTOM_CSS_URL`,
  `NEXT_PUBLIC_SUPPORT_EMAIL`, `NEXT_PUBLIC_DOCUMENTATION_URL`; keep TERMS/PRIVACY URLs.
- `apps/sim/package.json`: remove `@better-auth/sso` → regenerate `bun.lock` (below).
- Grep (always with an explicit path!) for `@/ee/` and `ee/` across apps/, packages/, scripts/.
- Biome may reorder moved imports.

## How to verify (no local builds — the owner's Mac has 8 GB)

CI on every push to `main` (`.github/workflows/typecheck.yml`):
1. `bun install --frozen-lockfile` → `tsc --noEmit` (apps/sim) → vitest (local copilot +
   a few suites) → results pushed to branch `ci-reports`:
   `https://raw.githubusercontent.com/azizmubashirov/labbai-sim/ci-reports/{status,typecheck,tests,install}.txt`
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
