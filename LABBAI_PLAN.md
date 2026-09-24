# Labbai — product decisions and cleanup plan

Labbai is a fork of Sim v0.8.59 (simstudioai/sim, Apache-2.0) with Arena's local copilot
ported in. We do not sync with upstream Sim; we develop it ourselves from here.

## Remove

- `apps/docs`, landing pages `apps/sim/app/(landing)`, `apps/sim/public/landing`, sim.ai
  marketing/SEO routes (`sitemap`, `llms.txt`, `changelog.xml`, contact / demo-requests / stars APIs)
- `apps/desktop` and desktop-only pieces: `browser-protocol`, `terminal-protocol`,
  `desktop-bridge`, desktop/browser/terminal settings, copilot browser_* / terminal tools
- `packages/sim-cli`, `sim-setup`, `cli`, `ts-sdk`, `python-sdk`, `helm`, CLI/desktop APIs
- Stripe billing: subscriptions, checkout, webhooks, upgrade and billing pages.
  Keep the usage ledger (credits); payments (Click/Payme) come later.
- Integrations: keep ~10% (list below), remove the rest with their tools, triggers,
  OAuth providers and knowledge connectors
- LLM providers: replace all with a single Cloudflare AI Gateway provider (Unified Billing,
  one account). Keep a short curated model list.
- Sim cloud copilot path (Go mothership client) and the Local/Cloud switch — local copilot only
- Copilot providers other than the OpenAI-compatible one (Bedrock, Vertex, Gemini)
- PII service (`apps/pii`), Pi / A2A / Mothership blocks, video generation,
  Sim Mailer inbox, code sandboxes (E2B/Daytona; plain JS function block stays),
  enrichments, Ollama/vLLM compose files
- Settings: BYOK, self-host, mothership, sandboxes, billing/credits/upgrade
- Routes: `playground`, `slack-search` / enterprise search, `custom-blocks`
- Organization UI layer (`/o/[organizationId]`); keep the DB tables
- `enterprise-owner-claims` API

## Keep

- Workflow canvas, copilot chat, Tables, Knowledge, Files, Logs, Integrations, Skills,
  Scheduled tasks, Secrets, API keys, MCP, Custom tools, members + roles,
  Recently deleted, wand (AI field generation)
- Telemetry — pointed at our own endpoint (`TELEMETRY_ENDPOINT`), not simstudio.ai
- Activity log, Access requests, Credential groups, Authorized apps,
  SCIM, audit-logs API, permission groups

## Enterprise (`apps/sim/ee`) — license

`apps/sim/ee` is under the Sim Enterprise License: no production use without a Sim
subscription and no modification. The directory is removed. Features we keep that
lived there (Activity log / audit logs UI, Access requests, Credential groups, SCIM,
permission groups / access control) are re-implemented as Labbai code — same behavior,
our own implementation (not copied from `ee`). Apache-licensed parts outside `ee`
(e.g. `packages/audit`, `packages/platform-authz`) are reused.

## Integrations kept (~10%)

Channels: Telegram, WhatsApp, Instagram, Twilio SMS, Gmail, SMTP ·
Google: Sheets, Drive, Docs, Calendar, Forms, Maps ·
CRM: HubSpot, Pipedrive, Notion, Airtable, Trello ·
Booking: Cal.com, Calendly, Zoom ·
Databases: PostgreSQL, MySQL, Supabase ·
Web/search: Firecrawl, Exa, Serper ·
Commerce: Shopify, WordPress · Voice: ElevenLabs.
Knowledge connectors: Google Drive, Google Docs, Notion.
Later: amoCRM, Bitrix24, Exely (not in Sim) — our own or via Pipedream MCP.

## Models (via Cloudflare AI Gateway)

Strong: `openai/gpt-5.5`, `anthropic/claude-sonnet` · Fast: `openai/gpt-5-mini`,
`google/gemini-flash` · Cheap bulk: Workers AI (Llama/Qwen) ·
Embeddings: `openai/text-embedding-3-small`.

## Build (new, after cleanup)

- **Chats (customer inbox)** — native section inside Labbai: every customer thread from
  Telegram / WhatsApp / Instagram (via Sim channel triggers) stored as a conversation,
  Telegram-like list + thread view, operator reply from the UI, per-conversation
  AI on/off (when off, the agent workflow skips that customer). Copilot-built channel
  agents feed this section automatically.
- **Credits** — Sim's ledger (`usage_log`, dollars stored, 200 credits = $1) with our
  markup via `COST_MULTIPLIER`; Click / Payme top-ups instead of Stripe.
- **Cloudflare AI Gateway provider** for Agent blocks + copilot (`cf-aig-authorization`
  header); needs Account ID, Gateway ID, API token in server `.env`.
- **Pipedream MCP** for OAuth apps we don't register ourselves.
- **Branding** — Labbai name, logo, colors, emails; UZ / RU interface.
- Own integrations: amoCRM, Bitrix24, Exely.

## Open issues found in testing

- Google OAuth (Sheets/Drive/…): self-host needs our own Google OAuth client
  (`GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`), or Pipedream.
- Secrets pasted into chat during testing (an OpenAI key, a Telegram bot token) must be
  rotated by the owner.
- Local copilot file writes use the `workspace_file` tool name; the new Sim file preview
  listens for `prepare_file_edit` — verify live preview manually.
- `DEFAULT_LOCAL_COPILOT_MODEL` is a Claude id; chats created without a picker choice
  (inbox, API) may resolve to Anthropic — point it at the Cloudflare/OpenAI default.
- Cloud mothership tool execution depends on `executor: 'client'` frames — irrelevant
  once the cloud path is removed.
- Test server `147.93.62.159` (`/root/labbai`, tunnel `localhost:3300`) still runs the old
  Arena build; the new Sim + copilot image needs a fresh DB volume (`labbai_pg_v2`).

## Order of work

Each step is its own commit, verified by CI (type check + tests) before the next:
small safe removals → integrations → Stripe → LLM providers → Cloudflare →
`ee` removal + Labbai re-implementations → organization UI → branding (Labbai, UZ/RU).
