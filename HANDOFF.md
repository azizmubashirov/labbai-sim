# Labbai — handoff (2026-09-26)

Read `LABBAI_PLAN.md` first: it is the source of truth for every product decision.
This file is the operational state for whoever continues the work.

## What Labbai is

Fork of Sim v0.8.59 (simstudioai/sim, Apache-2.0) + Arena's local AI copilot
(`apps/sim/local-copilot`), rebranded later as Labbai. We do NOT sync with upstream Sim.
Owner wants: **cleanup only for now, no new features**, then the owner tests it.

## Branches

- `main` — last green state: cleanup steps 1–4 done, type-check + tests + next build pass,
  deployed to the test server.
- `wip/ee-cleanup` — step 6 (remove `apps/sim/ee`); latest state is on
  `claude/peaceful-maxwell-vbuk8b` (merged with main, **type-checks**).
- `ci-reports`, `ci-build-report` — written by CI (see below). `arena-base` — old Arena code backup.

## Cleanup status (see LABBAI_PLAN.md "Order of work")

| Step | Status |
|---|---|
| 1 Docs, landing, desktop, CLI/SDK, helm, PII, sandboxes (JS-only Function), Pi/A2A/Mothership/video blocks, enrichments, Sim Mailer | done (main) |
| 2 Integrations trimmed to ~10% (list in LABBAI_PLAN.md) | done (main) |
| 3 Stripe and all payments removed; entitlements permissive; cost ledger kept | done (main) |
| 4 LLM: OpenAI only (gpt-5.5, gpt-5-mini default, gpt-4.1, gpt-4.1-mini, text-embedding-3-small); `OPENAI_BASE_URL` / `OPENAI_EXTRA_HEADERS` for a later Cloudflare switch | done (main) |
| 6 Remove `apps/sim/ee`, re-implement kept features clean-room | **almost done** — compiles; see "Status 2026-09-26" |
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
- Access requests re-implemented: `lib/labbai/access-requests/*`, `components/access-requests/*`
  (gap: no "grant me workspace access" request; preview impact counts approximate).
- SCIM 2.0 re-implemented: `lib/labbai/scim/*`, `components/settings/scim/*`, `hooks/queries/scim.ts`,
  Security page section (gaps: new accounts skip signup hooks, eq-only filters, no
  verified-domain check; `isScimEnabled` flag must stay).
- Custom blocks fully removed (registry, executor, copilot tool, VFS, logs, catalog `source=builtin` only).
  Leftover: remove `isCustomBlocksEnabled` (env-flags.ts + testing mock), `CUSTOM_BLOCKS_ENABLED`
  (+ NEXT_PUBLIC) from env.ts/.env.example; `settings-sidebar.test.tsx` and
  `workspace-section-access.test.ts` feature fixtures still list removed keys (dataDrains, sso, …).

### Status 2026-09-26 (branch `claude/peaceful-maxwell-vbuk8b` = `wip/ee-cleanup` + fixes)

Verified in a cloud container (15 GB RAM, bun 1.4.1):
- `tsc --noEmit` (apps/sim): **clean**.
- CI test set (`local-copilot lib/api-key lib/mothership/inbox`): 151/151 pass.
- `bun.lock` is consistent with `--frozen-lockfile` (checked with bun 1.4.1).
- Wider suites (settings, labbai, workspaces, users, auth, `app/o`, contracts): 19 failures,
  **all of them also fail on `main`** (left from steps 3/6: billing/enterprise expectations).
  CI does not run these suites.
- This branch is ready to merge into `wip/ee-cleanup` / `main` for a CI run.

Done in this pass (all former "Leftover TODOs" are closed):
- Navigation / deployment-shape / `ENTERPRISE_GATED_SECTION_LABELS`: were already clean on WIP.
- `env-flags.ts` + testing mock: removed flags for SSO, whitelabeling, session policies,
  forking, custom blocks, data retention, data drains, usage monitoring. Kept flags
  (`isAccessControlEnabled`, `isAuditLogsEnabled`, `isScimEnabled`, `isOrganizationsEnabled`)
  are constant `true`, and the mock now mirrors that.
- `env.ts` / `.env.example`: removed `ENTERPRISE_ENABLED`, all per-feature `*_ENABLED`
  overrides (+ `NEXT_PUBLIC_`), `SSO_*`, `NEXT_PUBLIC_BRAND_*`, `CUSTOM_CSS_URL`,
  `SUPPORT_EMAIL`, `DOCUMENTATION_URL`. TERMS/PRIVACY URLs kept.
- `bun.lock`: `@better-auth/sso` + SAML-only deps removed (package.json had already dropped it).
- No `@/ee/` / `ee/` references left in apps/, packages/, scripts/.
- Settings sidebar bug fixed: org-plane sections (Access Control, Audit logs, Security)
  were visible to non-org-admin members (links 404'd) after `selfHostedOverride` was removed.
- `audit-logs.tsx`: `Chip variant='default'` (not a valid variant; the only tsc error).
- Biome safe fixes applied repo-wide (222 files, import order + formatting).

Remaining (to do locally):
1. Fix or delete the 19 stale failing tests (list: run the suites above; mostly
   `app/o/[organizationId]/{integrations,settings}`, `lib/users/account-deletion*`,
   `lib/core/config/deployment-shape.dom`, `lib/settings/application/organization-section-access`,
   `lib/auth/sim-auth-adapter`, `lib/permission-groups/model-access`,
   `lib/workspaces/organization-workspaces`, `components/settings/standalone-settings-shell-seeding`).
2. Dead fork / retention code in workspace admin move: `lib/workspaces/admin-move.ts`
   (`findCrossOrgForkEdges`, `blockingForkEdges`, `fork-lineage-conflict`,
   `strippedRetentionRules`) and `admin-move-source-impact.ts`
   (`countRetentionRulesForWorkspace` / `stripRetentionRulesForWorkspace`). DB columns stay.
3. Data-drain blocker in `lib/users/account-deletion.ts` (`hasDataDrains`,
   `data_drain_owner` in `lib/api/contracts/user.ts`); drains cannot be created any more.
4. Biome issues that need `--unsafe` (unused imports, class sorting; ~40 warnings + 1 error):
   `bunx biome check apps/sim packages`.
5. Then steps 7 and the "+" rows in the table above.

Note: `bun install` needs `cdn.sheetjs.com` (xlsx tarball). In a network-restricted
environment, temporarily point `xlsx` at `0.18.5` with `bun install --no-save`, then
`git checkout apps/sim/package.json bun.lock`.

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
