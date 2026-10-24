# RealClear conversational polling foundation

Next.js + React + Vercel AI SDK, with Vercel AI Gateway and Neon Postgres selected for deployment. This is a runnable **authenticated research workspace** with RCP-token sign-in and durable account-owned question history. Chat now streams a bounded polling research agent using the signed-in user’s MCP connection. Live local MCP-backed answers and contextual follow-ups have been verified; there is no fabricated-data fallback.

For the next session, start with [the current session handoff](docs/NEXT_SESSION_HANDOFF.md), including current authentication, database, and integration state. Then read [the product handoff](docs/PRODUCT_HANDOFF.md) for the user journey and acceptance checks.

## Local development

Install [mise](https://mise.jdx.dev/getting-started.html) **2026.10.18 or newer**, inspect `mise.toml`, then:

```sh
mise trust
mise install
mise run install
cp .env.example .env.local # only when this file does not already exist
mise run dev
```

`mise.toml` pins Node **24.22.1**, npm **12.2.1**, and the optional Vercel CLI **65.2.0**. Its `min_version` is the latest mise release verified during setup, not a Node version range. Compiler, lint and application dependencies are pinned in `package.json` and `package-lock.json`, installed by `mise run install`. TypeScript 6 stays within the lint parser's supported range. ESLint 10 uses Next.js 16.4's compatibility fixes, with targeted peer overrides for plugins whose metadata still excludes ESLint 10. Run `mise exec -- vercel --version` to verify the optional CLI. Vercel-hosted builds use the platform's CLI and do not install our local deployment CLI or its dependencies.

| Command                   | Purpose                                                              |
| ------------------------- | -------------------------------------------------------------------- |
| `mise run dev`            | Local development server                                             |
| `mise run clean`          | Remove build and test outputs; keep credentials and dependencies     |
| `mise run build`          | Production build                                                     |
| `mise run check`          | Typecheck and focused tests                                          |
| `mise run lint`           | ESLint, no warnings                                                  |
| `mise run format`         | Format source and documentation                                      |
| `mise run format:check`   | Check formatting without edits                                       |
| `mise run ci`             | All checks followed by a production build                            |
| `mise run start`          | Run a built app locally                                              |
| `mise run db:migrate`     | Explicit database migration, never automatic on deploy               |
| `mise run deploy:preview` | Optional manual preview after all checks; requires Vercel login/link |

After startup, `GET /api/health` returns `{"status":"ok","scope":"web","chatEnabled":true,"integrations":"not-probed"}`. This checks the shell only, not model, database or MCP readiness.

## Vercel native Git deployments

The project is already connected to GitHub. **No second GitHub Actions deployment workflow is needed.** Vercel builds previews for branches/PRs and production for its configured production branch (`main`).

`vercel.json` runs `scripts/vercel.mjs` for installation and builds. Installation uses npm 12.2.1. The build formats the deployed `vercel.json`, then runs `npm run verify && npm run build`. The configuration stays included in formatting checks; source formatting, lint, typecheck or test failures still stop deployment. The wrapper translates Vercel's legacy `npm_config_cache_dir` to npm's supported `npm_config_cache`, preserving an explicitly configured cache. Vercel automatically persists Next.js build caches after successful builds; a first build or a build after failed deployments may have no cache to restore.

This gate runs inside Vercel, not as a separate GitHub Actions job. Enable the Vercel status check in GitHub branch protection if merges must also be gated. Vercel does not run mise: it selects Node 24 from `engines`; its managed patch must satisfy the declared minimum 24.22.1. If its runtime lags, the strict install will stop rather than silently use an older version.

In Vercel settings, verify root directory is the repository root, framework is Next.js, production branch is `main`, Node is 24.x, and repository build/install commands are not overridden. Do not configure `output: export`; the application will need server-side routes.

No deploy token is required in GitHub for native integration. Keep production data isolated from previews: connect separate Neon database branches and scope Vercel environment variables to Preview/Production. Never expose production credentials to untrusted fork previews.

## Neon persistence

The **Neon Postgres** project and separate production/preview branches are provisioned, with the initial schema verified on both. See [database setup](docs/DATABASE.md) for resource IDs and pending Vercel configuration. Set each environment's pooled, TLS-enabled connection as `DATABASE_URL`; optionally set a direct `DATABASE_MIGRATION_URL` where explicit migrations run. Use `vercel env pull .env.local` only after linking and choosing the intended environment, and preserve any existing local configuration first.

Run `mise run db:migrate` against a reviewed target. The migration runner discovers ordered versioned SQL files, applies each transactionally, and verifies its checksum on rerun. Existing migrations are repeatable; make future changes as new versioned migrations instead of editing an applied file. Migrations are intentionally excluded from ordinary builds to avoid simultaneous previews mutating production state.

The schema stores conversations, full ordered SDK message parts, and dataset snapshots. Composite owner foreign keys prevent mismatched parent/child owners. Unique request/role and sequence keys support retry handling; a partial unique index reserves one pending assistant turn per conversation. Private history APIs now resolve a live database session and scope every conversation/message query to the RCP account ID. The browser cannot choose its owner. User-question saves use a short row-locked transaction and a unique request ID for retries. Agent turns reserve one pending response per conversation, retain complete SDK text/tool parts and evidence snapshots, and fence retries against late completion. Stale pending responses become retryable after two minutes.

## AI Gateway and MCP

Set `AI_GATEWAY_MODEL` to a model available to your Vercel Gateway account. The example is a configurable starting point, not a claim about model availability. For local use, set `AI_GATEWAY_API_KEY`; Vercel-hosted calls may use supported Vercel OIDC. `src/lib/gateway.ts` creates the AI SDK model through Gateway rather than calling provider endpoints directly. Gateway also offers an OpenAI-compatible Chat Completions API; this app uses its native AI SDK provider so streamed message/tool parts stay typed. An earlier HTTP 403 no longer reproduces. Fresh minimal generation and a full local MCP-backed conversation succeeded with the current imported environment.

Set `RCP_MCP_URL=https://rcp.tazalabs.ai/mcp`. Browser sign-in supplies each user’s own token. The application does not read `RCP_MCP_TOKEN`; MCP connections require an explicit token from sign-in or the authenticated session’s decrypted credential. Never commit the token, include it in a client bundle, or log authenticated URLs. The transport factory sends an Authorization Bearer header. The sign-in input accepts either the raw token or a value prefixed with `Bearer `; the prefix is normalized server-side. `whoami` and tool discovery have been verified (see `docs/NEXT_SESSION_HANDOFF.md`); live race search, published averages and historical-average formats have been inspected. Eight read-only polling tools are exposed from live discovery; `whoami` and `send_feedback` are excluded. MCP content is treated as untrusted data.

The current cloud runtime reaches MCP and Neon with `NODE_USE_ENV_PROXY=1`. Keep that runtime setting separate from hosted application configuration. The sign-in and research screens use the supplied RealClearPolling screenshot’s purple/yellow theme. The top-right RCP + AI button opens chat with a running LED border (static with reduced-motion preferences). Chat starts minimized and is a resizable right-side overlay with full-window and minimize controls, collapsible history and an anchored composer. A labeled landing-page mock is the default backdrop; an optional toggle loads the actual RealClearPolling iframe. The site returned HTTP 403 in this workspace, so live iframe rendering is unverified. No polling figures are fabricated in the mock and no app credentials are shared with the backdrop.

## Authentication and rich answers

RCP token holders sign in at `/sign-in`. The server calls `whoami` and accepts its validated `account_id`; it never decodes or trusts a browser-supplied user ID. Different verified tokens for the same RCP account resolve to the same conversation owner.

Set these **server-only** variables before enabling sign-in:

- `APP_ORIGIN` (optional): strict public-origin override for custom reverse proxies. Normally the app derives its origin from the request Host, using HTTPS except for localhost. Origin and Host must match; client Origin and forwarded-host headers do not define the trusted origin.
- `RCP_TOKEN_ENCRYPTION_KEY`: 32 cryptographically random bytes encoded as 64 hex characters. Keep this key stable, backed up securely, separate from the database, and consistent across instances. Changing it requires re-encrypting stored credentials or asking users to sign in again. Never commit or print it.
- `DATABASE_URL`: intended runtime database. Apply all migrations through `0005_protection` explicitly before serving chat; schema migration is not a deployment build step.

The local workspace has a generated key and localhost origin in a gitignored, mode-0600 `.env.local`. These settings have **not** been installed into Vercel. Inherited variables take precedence. HTTPS deployments need a secure encryption key and migrated database; a separate origin setting is no longer required.

The database stores account IDs in `app_users`, AES-256-GCM encrypted per-sign-in credentials in `rcp_credentials`, and SHA-256 hashes of random 256-bit session IDs in `user_sessions`. Encryption authenticates the owning user ID. The browser receives only an HttpOnly, SameSite=Lax, host-only session cookie; HTTPS adds Secure and the `__Host-` prefix. MCP credentials and session IDs are never placed in local storage. Unsent question drafts are saved opportunistically in browser local storage, scoped to the account and conversation, including a separate new-chat draft. Drafts restore on reload (up to 30 days), retain valid edit context, and clear when the server accepts the message; blocked storage never prevents chatting. This is local device persistence, not cross-device synchronization. Sessions expire after 30 days without silent renewal. Logout revokes the current session in the database; signing in again replaces that browser’s prior session. Separate JWT access/refresh tokens are unnecessary for this server-rendered app.

Cookie-authenticated writes compare Origin with the request host (or the explicit override). Input sizes and MCP deadlines are bounded, and raw SDK/database errors are not returned to the browser. Operational failures return a reference ID; runtime logs contain only the matching reference, operation stage and an allowlisted error code (including missing/invalid token-encryption key and unavailable/unmigrated database), never credentials or raw exceptions. Each application session remains valid until its own expiry or logout; revoking an RCP token does not currently push a revocation event into this application. Future MCP calls must handle upstream token rejection by requiring reconnection. Expired/revoked sessions and encrypted credential records are retained; automated retention cleanup and account-wide session management are not implemented.

History lists the 100 most recently active unpinned chats, ordered by last message time, plus all pinned favourites in an upper section. Pinning and renaming do not bump activity. Each chat supports manual rename and title regeneration. Automatic and regenerated titles use `openai/gpt-6-luna` with the existing Gateway credentials, independently of the answer model; manual titles are protected from background generation. Existing conversation links remain accessible to their owner. The composer streams answers and lookup progress, sends on Enter (Shift+Enter for a newline), and transforms Send into Stop while waiting or streaming. The latest question can be edited and resent to replace its answer; stale edits are rejected. Retry and reopening saved text/tool evidence are supported. The server loads account-owned history and credentials; client-supplied history is never trusted. Research is limited to six model steps, ten MCP calls, two concurrent tool calls, 12 seconds per lookup, 90 seconds overall, 3,000 output tokens per step, 120,000 characters per tool result and 350,000 characters of saved context. Oversized context requires a new conversation.

The preview uses replaceable CSS and a safe Markdown renderer with GFM tables, raw HTML disabled, images disabled, and safe external-link handling. Evidence details start collapsed while published-average tables and historical-average charts stay visible. Charts bind to saved MCP observations, preserve missing-value gaps, show actual dates and a 0–100% axis, and include an expandable observation table. Additional chart types remain follow-on work. Model text must never become executable JSX/HTML or independently supply chart numbers.

## Shared capacity and failure handling

Postgres coordinates admission across Vercel instances, using the verified RCP account ID rather than a browser session or token. No extra service or environment secret is needed. Apply migration `0005_protection` before deploying this code.

| Budget                      | Chat turns (including edits/retries) | Title generation (automatic/manual) |
| --------------------------- | ------------------------------------ | ----------------------------------- |
| Per account                 | 8/minute, 60/hour                    | 3/minute, 20/hour                   |
| Per account in flight       | 2                                    | 1                                   |
| Whole application           | 40/minute                            | 20/minute                           |
| Whole application in flight | 20                                   | 4                                   |
| Crash-recovery lease        | 120 seconds                          | 30 seconds                          |

These are conservative starting limits, not measured throughput promises. Windows begin with the first admitted request and do not slide; boundary bursts are possible. Limits count turns, not individual model steps or MCP calls; existing per-turn step/tool bounds still apply. Admission uses a short transaction with an advisory lock; no lock is held while waiting for upstream services. A rejected admission neither reserves a message nor consumes quota. Admitted attempts consume quota even if subsequent setup fails. Leases release on completion, cancellation and setup failure, with expiry as the fallback for terminated workers. If protection storage is unavailable, new expensive work fails closed.

Separate shared Gateway and MCP circuit breakers open for 30 seconds after five consecutive transient failures within 30 seconds. A single recovery probe is allowed globally; successful recovery closes the circuit, another failure reopens it, and probe expiry recovers a crashed worker. Epochs fence stale responses from closing a newly opened circuit. Gateway health is recorded per answer/title; MCP health observes chat HTTP transport requests. HTTP 429/5xx and recognized network errors count; credential/input errors, local throttling and user cancellation do not. MCP protocol errors inside HTTP 200 responses are not circuit signals. Sign-in is outside these chat admission limits.

HTTP rejections carry 429 (per-account limits) or 503 (shared capacity/circuit/storage), safe error codes and `Retry-After`. Chat keeps rejected drafts/edits, restores the previous answer after rejected edits, and disables Send/Retry during the displayed cooldown. Once streaming starts, HTTP status cannot change: provider failures use the existing streamed error and saved-question retry flow. Database calls now create a fresh timeout for each operation, so long-running responses can still save their final state.

This is bounded demo protection, not a public-launch abuse or availability guarantee. Before launch: tune limits against real traffic and provider quotas, add metrics/alerts, edge protection for anonymous sign-in and inexpensive endpoints, database maintenance/retention, and load/soak tests. Postgres is a shared dependency and the admission lock is a deliberate simplicity/throughput tradeoff. No automatic retries or durable background queue are introduced.

## Validation and remaining scope

`mise run ci` runs formatting, ESLint, type checking, configuration, identity, encryption, cookie/CSRF boundary tests, embedded Postgres ownership/session/history tests, and the Next.js production build. Embedded tests exercise two accounts, different tokens for one account, expiry, revocation, and duplicate requests. Live browser verification separately covers real RCP login, Neon-backed save/reload, logout, old-cookie rejection, and history after a fresh login. Two distinct real RCP accounts/tokens were not available. See [docs/OUTLINE.md](docs/OUTLINE.md) for the follow-on scope and [docs/PROGRESS.md](docs/PROGRESS.md) for actual validation and time accounting.

Deterministic model tests verify the real SDK tool loop, follow-up replay, provider failure and cancellation. Production-build browser checks verify live sign-in, safe Gateway failure, persistence, duplicate-free retry and responsive layout. A subsequent real Gateway/MCP browser check also passed: sourced answer, saved evidence, reload and contextual follow-up. Additional chart types, supplied HTML integration and hosted chat verification remain unfinished.

See [Agent sessions and memory review](docs/AGENT_SESSIONS_AND_MEMORY.md) for the current authentication/conversation/run/MCP boundaries, persistence gaps and recommended context/memory extensions. Cross-chat memory and durable background runs are not implemented.
