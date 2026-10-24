# Next session handoff

Updated October 24, 2026. Start with this file for current infrastructure state, then read `docs/PRODUCT_HANDOFF.md` for the product requirements and acceptance checks. This file supersedes older statements about unprovisioned databases, unsupported ESLint 10, and unverified deployment/model availability.

## Shared protection, launcher and drafts — October 24, 2026

The top-right RCP + AI button now opens the initially minimized chat panel. Its running LED border respects reduced-motion preferences, works on mobile and over either backdrop, and receives focus after minimizing. Drafts persist opportunistically in local storage per verified account/conversation (plus a separate new-chat draft); reload restores text and valid edit context. Storage failures do not block chat. Accepted messages clear the draft; rejected admissions retain it and restore any previous answer.

Migration `0005_protection` is applied to preview and production. Shared Postgres admission limits chat to 8/minute and 60/hour/account, 2 active/account, 40/minute and 20 active globally. Titles use 3/minute and 20/hour/account, 1 active/account, 20/minute and 4 active globally. Expiring leases recover terminated workers. Shared Gateway/MCP circuit breakers open after five consecutive transient failures within 30 seconds, cool down for 30 seconds, and admit one fenced recovery probe. Admission failures return 429/503 with Retry-After; chat shows a cooldown and keeps unsent text. No new secrets or services. See README for exact limits and boundaries.

Database timeouts are now per-operation rather than per-repository, fixing saves after a long stream. Concurrency checks used eight overlapping Neon HTTP transactions: exactly two admissions and six user-limit rejections, with exactly two durable leases. Deterministic tests cover global/hour/minute budgets, expiry, circuit recovery and stale results, cancellation/auth exclusions, safe HTTP responses and draft isolation. Browser verification covers the launcher, 429/503 responses, live MCP-backed completion and rejected edits retaining the previous answer. This is not a load/soak test or production-scale availability claim; anonymous sign-in/cheap endpoints still need edge protection before public launch.

All 62 tests and production gates passed. Browser verification additionally confirmed persisted new/edit drafts, accepted-draft clearing and throttled retries retaining their saved turn and separate unsent draft. A real HTTP 429 check inserted zero messages. See `docs/AGENT_SESSIONS_AND_MEMORY.md` for the requested architecture review: app-owned message replay exists; cross-chat user memory, structured conversation state and durable background runs do not. Recommended order is conversation context/token budgeting, then explicit user preferences, then durable runs only when needed.

## RCP-themed overlay workspace — October 24, 2026

The user requested a RealClearPolling-styled overlay rather than a standalone research page, then authorized a simple landing-page mock if the site cannot be framed. The app now uses deep purple, yellow highlights, sans-serif headings and light dividers based on the supplied screenshot. A labeled static landing-page mock is the default backdrop; it contains no invented polling results. “Try live website” mounts the real `https://www.realclearpolling.com/` iframe, and “Use preview backdrop” restores the mock. Open-site and reload controls are available. Direct fetch and Chromium both received HTTP 403 from the live site in this environment; framing policy is not established and successful live website rendering is not claimed. Do not bypass that site restriction.

The right panel starts at 520px, can be dragged from 360px to full-window width, supports keyboard arrows/Home/End and double-click resizing, and has explicit Expand/Restore and Minimize/Reopen controls. The root-layout shell persists through navigation; minimizing preserves chat state/drafts. On mobile the panel occupies the viewport. History starts collapsed, opens above the chat at narrow widths, and becomes a left sidebar at widths of 850px or more. Pinned/Recent groups also collapse independently. Container queries respond to panel width rather than the background viewport. Messages and history scroll independently; the composer remains anchored. Sign-in uses the same themed panel.

The backdrop does not provide page context to the agent or share application credentials. The optional iframe is cross-origin, no-referrer and sandboxed; hidden background controls become inert when expanded. No database changes or new environment variables were needed. Existing authentication, editing, Stop/Retry, pinning and title generation remain wired.

All 49 tests, formatting, zero-warning lint, TypeScript and production build passed. Chromium verified mock/live switching, actual iframe URL, drag/minimum/keyboard sizing, full-window restore, narrow/full history layouts, collapsed groups, minimize/draft persistence, real chat generation, saved evidence/chart reload, independent scrolling, anchored composer and 390px layout without horizontal overflow or JS errors. A real SVG tooltip hydration mismatch found during verification was fixed by rendering each title as a single text node. Temporary test conversations were removed; production app remains running locally. Hosted layout remains unverified from this workspace.

## Composer and chat organization — October 24, 2026

- Composer focus stays inside its spacing. Enter sends, Shift+Enter inserts a newline, IME composition Enter is ignored. The primary Send button becomes Stop during setup, waiting and streaming. Editing the last user question replaces that turn and regenerates the answer; cancel restores the unsent draft. Row locks, expected prior request IDs and new generation IDs protect concurrent/stale edits; earlier turns remain intact.
- Sidebar has an upper Pinned section (empty when none), followed by Recent chats ordered by actual message activity. Pin/unpin, manual rename and Regenerate title are available in each row's action menu. Renaming and pinning do not alter message recency. All pinned chats are included alongside the 100 most recent unpinned chats.
- Automatic and explicit title generation use **`openai/gpt-6-luna`**, confirmed in Gateway discovery and live browser tests. Initial titles generate after the response with Next `after`; the UI briefly refreshes pending titles. Generation receives bounded user-question text only, with a 12-second deadline. Explicit regeneration can replace a manual title; automatic generation cannot. Revision checks prevent delayed generation from overwriting a newer manual edit.
- Migration `0004_chat_preferences` adds pinned_at/title_source/title_revision and is applied to preview and production. No new environment variable is required; the existing Gateway authentication is reused and the answer model is unchanged.
- All 49 tests, formatting, zero-warning lint, TypeScript and production build passed. Real Chromium checks verified Enter, Shift+Enter, IME handling, non-overlapping focus, Send/Stop transition, live edit/regeneration and reload, cancellation with durable interrupted status, automatic GPT 6-Luna title display, pin persistence, manual rename and live title regeneration, message-recency ordering, CSRF/anonymous rejection, and responsive desktop/mobile layout. Temporary verification conversations were removed.

## Chat evidence UX — October 24, 2026

MCP source details now start collapsed. Published-average tables for race/detail comparisons and historical endpoint-change tables remain visible outside the disclosure. Valid historical-average observations render a responsive SVG time-series chart with date-proportional spacing, a labeled 0–100% support axis, candidate legend, missing-value gaps and an expandable exact-observation table. Invalid, duplicate-date or insufficient history does not render a chart. Search discovery results do not generate a stack of unsolicited average tables. Markdown tables remain supported for other evidence-backed comparisons.

All 43 tests, zero-warning lint, type checks and production build passed. Chromium verified real MCP average/history values in temporary saved-message fixtures, default-collapsed source details, disclosure toggling, visible tables/chart, and desktop/390px layouts without horizontal overflow. Fixtures were removed. The fixture prose was explicit test text; the live generation verification below remains the last full agent check.

## Latest verification: live local agent passes — October 24, 2026

This supersedes the Gateway blocker recorded below. After the user said the required environment variables were imported, fresh diagnostics confirmed both Gateway variables ready and the running application's key/model matching the current runtime (compared without exposing credentials). Gateway reported a $15 balance and minimal generation succeeded. The earlier HTTP 403 no longer reproduces; the cause of the change was not independently established.

Chromium against the local production build completed a real MCP-backed Maine Senate question, verified complete persisted assistant status, tool output and a source citation, reopened the evidence table, then completed and reopened a contextual follow-up. No browser JavaScript errors occurred. The temporary verification conversation was removed. No application code or secret changes were needed. GitHub reports Vercel deployment success for `0cf0a5a`; hosted chat is still unverified because the workspace cannot reach the application hostname.

Next priority: verify the hosted chat flow with its own environment configuration. Charts and remaining product acceptance checks are subsequent work. Local model generation is no longer a blocker.

## Current priority: finish live agent verification — October 24, 2026

The user confirmed hosted sign-in works and requested agentic chat over their MCP connection. The chat agent is implemented; older save-only/disabled-composer sections below are historical.

- Server resolves the session’s encrypted RCP credential, discovers schemas and exposes eight read-only polling tools. `whoami` and `send_feedback` are excluded. The app never uses an environment MCP token.
- AI SDK streams a bounded multi-step tool loop with account-owned server history. Questions, complete text/tool parts and normalized evidence snapshots persist in messages. Follow-ups replay saved evidence. Average tables use MCP values; historical support changes are calculated from actual returned endpoints, preserving nulls, coverage and URLs.
- UI shows tool progress, streaming prose, evidence, Stop and Retry. Row-locked reservation, unique request IDs, per-attempt generation IDs and a two-minute stale threshold protect concurrent sends and interrupted retries. Migration `0003_generation` is applied to preview and production.
- Limits: six model steps, ten MCP calls, concurrency two, 12 seconds per lookup, 90 seconds overall, 3,000 output tokens per step, 120,000 characters per tool result, 350,000 characters of historical context. Failures remain explicit and retryable, without invented answers. Full final tool evidence is retained with the message; separate datasets/chart records are not implemented.
- Formatting, zero-warning lint, TypeScript, all 42 tests and production build pass. Tests cover the actual SDK loop with a deterministic model, complete history replay, cancellation, safe provider errors, and database reservation/retry/stale fencing and account isolation.
- Chromium against the production build verified real login, persisted Gateway failure, duplicate-free retry, reload and fresh-login history, logout, CSRF/anonymous rejection, 390px layout, and no browser JavaScript errors. Test conversations were removed. Local app runs without an environment MCP token or APP_ORIGIN override.
- **Remaining blocker:** the current local Gateway credential still returns HTTP 403 with a billing/credit indication for minimal generation. Successful live AI answers have not been verified. No mock fallback was added. Once Gateway access is restored, verify a sourced live turn, follow-up, cancellation and reopened conversation, then hosted chat. The workspace proxy still blocks the Vercel application hostname; a successful deployment status is not a hosted chat test.

### Next verification

Restore Gateway billing/access for the intended environment, then ask a current Maine Senate question and a historical follow-up. Race discovery supports text query `Maine` and facet state `me`; inspected race 9100 is the 2026 Senate race. Historical output is columns `date,results,spread`, with candidate tuples and an unsigned spread; never interpret it as a signed party margin. Check actual returned dates against requested bounds. `/api/health` reports chat capability and `integrations: not-probed`, not external service readiness.

## Sign-in origin fallback and safe diagnostics — October 24, 2026

The user reported a generic sign-in failure at `https://tz-chat-alexlopashev-gmailcoms-projects.vercel.app/sign-in`. The previous code required `APP_ORIGIN` before validating the token; absent configuration caused the exact generic error. Local checks had an origin configured and missed that scenario. Hosted root cause is not confirmed: this workspace's proxy rejects CONNECT to the Vercel app hostname with HTTP 403 and Vercel CLI is unauthenticated. GitHub reported the prior deployment successful, which does not verify runtime sign-in.

`APP_ORIGIN` is now optional. The app compares Origin with the request Host and uses HTTPS except on loopback; an explicit override remains available for custom proxies. The request Origin and arbitrary forwarded-host headers cannot define the expected origin. Session-cookie selection uses the same rule for pages and route handlers. Regression tests cover the reported Vercel hostname, missing origin configuration, cross-origin rejection and spoofed forwarded-host headers.

Missing/invalid encryption keys and database failures now have safe operational codes. Sign-in records a stage and reference ID in runtime logs without raw errors, SQL, URLs, token values or encryption keys. A failed sign-in returns the matching reference ID for support. Look for `application_request_failed`, then code/stage: `TOKEN_KEY_MISSING`, `TOKEN_KEY_INVALID`, `DATABASE_NOT_CONFIGURED`, `DATABASE_SCHEMA_MISSING`, `DATABASE_PERMISSION_DENIED`, `DATABASE_UNAVAILABLE`, or `AUTH_ORIGIN_INVALID`. The encryption key still must be 64 hex characters; surrounding whitespace is trimmed without changing the key material.

All 33 tests and production build passed. Chromium sign-in, save/reload, logout, old-cookie rejection and fresh-sign-in history restoration passed with no configured APP_ORIGIN or global MCP token. The actual route also accepted matching hosted Host/Origin headers through input validation (HTTP 400 for empty input) and rejected a different Origin (HTTP 403). No hosted runtime or production key/database configuration was independently verified.

## Removed shared MCP token fallback — October 24, 2026

The application no longer reads `RCP_MCP_TOKEN`. `connectPollingMcp` requires an explicit token argument and fails before opening a transport when it is missing or invalid. MCP validation takes explicit `url`/`token` input rather than defaulting to process environment. Sign-in supplies the submitted token; subsequent authenticated MCP work should use `currentRcpToken()` from the validated session. `.env.example` no longer lists a shared token.

All 29 tests and the production build passed. Regression tests verify missing tokens cannot fall back to an environment credential, caller tokens take precedence, and explicit tokens work with no environment credential. The production server was restarted with `RCP_MCP_TOKEN` unset; its absence was checked using names/presence only, including the local dotenv file. A separate browser test harness supplied the real token as form input. Sign-in, encrypted storage round-trip, cookie persistence, save/reload, logout, old-cookie rejection and fresh-login history restoration passed; the generated test conversation was removed. No shared credential is required by the running application. Cloud/Vercel secret settings were not edited.

## RCP sign-in and durable history — October 24, 2026

This supersedes older statements that end-user identity and private history endpoints are absent.

- `/` redirects signed-out visitors to `/sign-in`. The responsive sign-in page explains how to sign in at RealClearPolitics, open `https://rcp.tazalabs.ai/`, and copy the MCP token. The public connection page was inspected and requires RealClearPolitics sign-in; the authenticated token-management UI was not inspected.
- POST `/api/auth/sign-in` accepts raw or Bearer-prefixed tokens and verifies `whoami`. Only its validated `account_id` becomes the user ID. Browser/model owner IDs and decoded token claims are never trusted.
- Random 256-bit session IDs live only in HttpOnly SameSite cookies; their SHA-256 hashes, expiry and revocation live in Postgres. HTTPS uses Secure `__Host-` cookies; HTTP is allowed only for localhost development. Sessions last 30 days without silent refresh. Logout revokes the current session; a fresh sign-in replaces the current browser session.
- Tokens are AES-256-GCM encrypted, with account ID as authenticated context, in `rcp_credentials`. Sessions link to those credentials and `app_users`. Chats remain owned by the stable RCP account ID across sessions and different tokens. No token/profile metadata is sent to the UI or model.
- `/api/conversations`, `/api/conversations/[id]`, and message saves require a valid session and scope all history queries by account. Writes enforce the configured Origin. Question saves serialize with a database row lock and use request IDs to prevent duplicate messages on retries.
- The workspace supports saving questions, listing recent chats, reopening messages and signing out. It explicitly states that live answers are not connected; no assistant output is fabricated. Lists show the 100 most recent chats; older direct links remain available.
- `0002_identity` adds users, credentials and sessions. It passed embedded Postgres checks and was applied to the existing preview branch, then to the configured database via the migration runner. Endpoint mapping is now verified: `ep-solitary-pine-b7cz50n4` belongs to **production**, `br-red-cherry-b7aqykv9`. Both baseline and new migration checksums were verified on the configured database. The runner now discovers versioned SQL files.
- A local-only encryption key and `APP_ORIGIN=http://localhost:3000` were created in gitignored mode-0600 `.env.local`, without printing them or replacing inherited credentials. Preserve this key. Hosted sign-in requires its own secure `RCP_TOKEN_ENCRYPTION_KEY`, exact HTTPS `APP_ORIGIN`, and migrated database. No Vercel configuration or deployment was changed.
- Real Chromium checks passed: unauthenticated redirect; invalid token error with no session; real RCP sign-in; persistent HttpOnly cookie and no local storage; save and reload through Neon; same-origin enforcement; anonymous history denial; logout and old-cookie denial; fresh login reopening the same history; desktop and 390px layouts; no JavaScript errors. Browser verification used one real RCP account/token. Separate embedded tests verify two-account isolation and different-token/same-account continuity; do not describe these as two real RCP account tests.

Final verification: `mise run ci` passed formatting, zero-warning ESLint, TypeScript, all 26 tests and production build. Chromium end-to-end checks passed against real RCP and Neon. The generated browser-test conversation was removed afterward. Session/UI implementation took approximately 15 minutes; earlier trial budget remains unknown.

Next: resolve Gateway billing/credit, then wire real polling retrieval and the sourced generation lifecycle. Account-wide session management, automated expired credential/session cleanup, upstream revocation propagation, and hosted verification remain future work. RCP token revocation does not automatically end an existing application session; sessions currently end on application expiry/logout. No account email/name is available from `whoami`.

## MCP authentication and identity verified — October 24, 2026

This supersedes the MCP 401 blocker below. The user confirmed Authorization Bearer authentication. The factory now sends the token only in that header; configuration accepts raw tokens or a case-insensitive `Bearer ` prefix, trims surrounding whitespace, and rejects empty/malformed values. Live initialization, tool discovery and `whoami` succeeded through the updated factory.

Discovered tools: `whoami`, `search_races`, `get_race`, `get_race_polls`, `get_race_average_history`, `compare_races`, `list_pollsters`, `get_race_ratings`, `get_rating_changes`, `send_feedback`. Do not expose `send_feedback` automatically: it submits external feedback. Every tool requires a purpose string of at least ten characters; optional purpose_kind accepts research, journalism, campaign, academic, personal or other.

`whoami` returned a successful text content block containing JSON with `account_id`, `token_id`, `token_prefix`, `session_id`, `server`, `client`, `purpose`, `purpose_kind`, and `call_id`, followed by a connection summary. No display name, email, avatar or account permissions were returned. Use the server-validated account ID as the candidate ownership identity; cross-token stability remains untested. Expose only allowlisted UI fields (for example a shortened account ID); keep token metadata and upstream session IDs out of UI/model history. Mint the application's own session cookie. Do not treat client/server names as user names or parse numeric call IDs as exact JavaScript numbers without verifying their representation.

The SDK encountered HTTP 400/405 during negotiation/optional transport requests, but initialization, tools/list and tools/call completed successfully. Polling retrieval itself remains untested. Gateway billing/credit remains a separate blocker.

## Latest access verification — October 24, 2026

This section supersedes the older readiness and database-network blockers below.
The clean checkout was fast-forwarded from `5330795` to `61d9611` to obtain this handoff.

- The attached configuration ID remains `5bd94cbf-e7eb-4525-b415-818104f3e776~cecfg_6adcd6515928819ab6f67c6a862d7275`, revision **2**. The status tool now reports `observations_current: true`, all seven expected runtime variables **ready**, and network policy **enforced**. The profile display name remains unavailable; do not claim independent confirmation of the name `tz-trial`.
- The missing-variable problem is resolved in this runtime. Use inherited variables; no replacement `.env` is needed.
- **Neon access succeeds.** With `NODE_USE_ENV_PROXY=1`, the existing HTTP driver reached `api.c-13.us-east-1.aws.neon.tech` with HTTP 200. A read-only query confirmed database `tz_chat` and the `public.conversations`, `public.messages`, and `public.datasets` tables. The API host is now in the enforced policy. No migrations or application writes were performed; endpoint-to-branch mapping still needs verification before writes.
- **MCP remains blocked:** initialization through `src/lib/mcp.ts` returned HTTP 401 using the existing query-token contract. No tool schemas or data were retrieved. The service credential or authentication contract needs verification with the service owner through secure settings.
- **Gateway remains blocked:** a minimal generation through `src/lib/gateway.ts` returned HTTP 403 with a billing/credit indication. Resolve account billing/credit; catalog access is not proof of generation readiness.
- The probes used temporary transpiled copies of the existing factories, retained their server-only boundaries, and reported only status/allowlisted metadata. No secrets, authenticated URLs, or raw errors were recorded.

The next priority is MCP credential/contract verification and Gateway billing/credit resolution, then discovery and minimal generation again. Repeated restarts or reinjecting identical variables are not supported fixes. End-user identity is still unconfirmed and private product endpoints remain closed.

Verification: clean `npm ci` and `mise run ci` passed (formatting, lint, TypeScript, 9 tests, production build). Restarted the production shell with `NODE_USE_ENV_PROXY=1 mise run start` on port 3000; `/` and `/api/health` returned HTTP 200, with `liveChat: false`. No browser or hosted integration was verified.

## Runtime recheck — October 24, 2026

This recheck supersedes the missing-variable observations below. The clean checkout was fast-forwarded from `5330795` to `926aa51` before inspection.

- Attached configuration ID still matches `5bd94cbf-e7eb-4525-b415-818104f3e776~cecfg_6adcd6515928819ab6f67c6a862d7275`; current reported revision is **2**, executor `afe5c61a1d48`. The connector still does not expose the profile name, so the name `tz-trial` is not independently confirmed. Revision numbers across runtimes do not establish ordering or successful application.
- All seven expected variables are now present in the process environment: `DATABASE_URL`, `DATABASE_URL_UNPOOLED`, `DATABASE_MIGRATION_URL`, `AI_GATEWAY_API_KEY`, `AI_GATEWAY_MODEL`, `RCP_MCP_URL`, `RCP_MCP_TOKEN`. No `.env` or `.env.local` is present in the checked project/workspace/home locations. No secret-file bindings are reported. Use the inherited variables; do not recreate the historical local file or request secret values in chat.
- Connector readiness and network enforcement remain **unknown**. Presence alone did not establish valid credentials or successful access.
- Database URLs now target `ep-solitary-pine-b7cz50n4[-pooler].c-13.us-east-1.aws.neon.tech`, database `tz_chat`, with required TLS. These differ from the old preview endpoints. The intended branch mapping must be verified before writes; no migrations or application writes were attempted.
- Node outbound requests need the cloud proxy enabled with `NODE_USE_ENV_PROXY=1`. Without it the Gateway call failed with `EAI_AGAIN`. Keep inherited proxy/CA settings; do not change production configuration merely for this cloud runtime.
- **MCP:** authenticated initialization through `src/lib/mcp.ts` reaches `rcp.tazalabs.ai`, but receives **HTTP 401**. Tool discovery and schemas remain unverified. The expected base URL is present; the supplied token is rejected using the existing query-token contract. Verify the credential/contract securely with the service owner.
- **Gateway:** a minimal generation through `src/lib/gateway.ts` reaches Gateway, but receives **HTTP 403**, with a billing/credit indication in the response. No successful generation was observed. Check account credit/billing rather than treating catalog availability as generation readiness.
- **Neon:** the installed HTTP driver's default SQL destination is `api.c-13.us-east-1.aws.neon.tech`, not the connection-string hostname. That destination is absent from `/etc/codex/network-policy.json`. An HTTPS probe through the inherited proxy was rejected during CONNECT with **403**; the driver read failed before SQL could run. Add this destination through the supported environment settings workflow. Do not override the driver endpoint or bypass the proxy to avoid the policy.
- No environment-switch or configuration-write tool is available in this session. No secrets, authenticated URLs, raw integration errors, or MCP payloads were added to repository files.

Clean installation and `mise run ci` passed (formatting, lint, TypeScript, 9 tests, production build). The production shell was restarted with `NODE_USE_ENV_PROXY=1 mise run start`; `/` and `/api/health` returned HTTP 200, with `liveChat: false`. No browser or hosted integration was verified.

The missing-secret injection problem is no longer reproduced. The next integration priority is the three concrete access blockers above, followed by the same read-only/schema discovery/minimal generation checks. A profile rename, restart alone, or another identical variable entry is not established as a fix. Private product endpoints remain closed pending end-user identity.

## Current checkpoint

- Repository: `alexlopashev/tz-chat`, workspace `/workspace/tz-chat`. The local branch is `work`; previous changes were pushed to `main` using ordinary fast-forward pushes. No extra worktree is needed.
- The application is still a foundation preview. Its composer is disabled, there is no chat endpoint, and `/api/health` reports `{"status":"ok","scope":"web-shell","liveChat":false}`. A healthy shell does not establish working chat, MCP or database access.
- Native Vercel Git deployment is configured. The deployment for commit `525e503` succeeded according to GitHub's Vercel status. The later database documentation commit is `0a39cbe`; its deployment was not checked. Do not present the earlier success as verification of every later deployment.
- Local clean installation, formatting, lint, TypeScript, all nine tests and production build passed without observed warnings/errors. The full application dependency audit reports zero vulnerabilities.
- A production server was left running on `0.0.0.0:3000`, started with `mise run start`. Both `/` and `/api/health` returned HTTP 200. Recheck after a session/environment change; do not assume the process survives.
- AI Gateway model discovery succeeded locally using the inherited key, and `openai/gpt-6.1-sol` was listed. No paid model generation or live conversational turn was verified.

## First priority: resolve the environment mismatch

The user says all variables/secrets were entered into a `.env` file in the **tz-trial** CloudVM settings, then saved/published. Repeated checks could not find that file or its MCP credential in this chat's running VM. Do not ask the user to paste secrets into chat, repeatedly request the same settings change, or assert that a restart will fix it without evidence.

Latest observations:

- The cloud environment connector reported `provider: cloud`, connected/running, and revision **14**. It did not expose the environment's human-readable name, so we could not establish whether its attached configuration was the `tz-trial` profile the user edited.
- The source configuration ID was `5bd94cbf-e7eb-4525-b415-818104f3e776~cecfg_6adcd6515928819ab6f67c6a862d7275`.
- It reported **no secret-file bindings**, and only `AI_GATEWAY_API_KEY` as a runtime variable. Its readiness and network enforcement states were **unknown**. A changing revision is not proof that settings were applied successfully; earlier replies overstated that.
- The executor hostname was `a9e8ec6a2159`; `/workspace/tz-chat` was present. These are observations to help compare runtimes, not stable identifiers to assume next time.
- There was no `.env` in the project, workspace root, home or usual mount locations. Next.js loaded only the `.env.local` created during this session.

Current local configuration:

| Variable                 | Source / status                                          |
| ------------------------ | -------------------------------------------------------- |
| `AI_GATEWAY_API_KEY`     | Inherited from the VM; Gateway model discovery succeeded |
| `AI_GATEWAY_MODEL`       | `.env.local`: `openai/gpt-6.1-sol`                       |
| `DATABASE_URL`           | `.env.local`: preview branch, pooled TLS connection      |
| `DATABASE_MIGRATION_URL` | `.env.local`: same preview branch, direct TLS connection |
| `RCP_MCP_URL`            | `.env.local`: `https://rcp.tazalabs.ai/mcp`              |
| `RCP_MCP_TOKEN`          | Missing; actual MCP discovery was not attempted          |

The local `.env.local` is gitignored and mode 0600. It contains real preview database owner credentials retrieved through the connected Neon plugin. Preserve it, never commit/print it, and do not replace inherited proxy credentials. If the user's `.env` arrives, reconcile intended branch/values carefully: Next.js loads `.env.local` ahead of `.env`, and inherited variables take precedence over both.

Direct local Neon HTTP access failed. A separate network check found a proxy-denial indicator in the exception cause chain. The reported allowed domains omitted both required preview hosts:

```text
ep-old-shape-b7dq98pg-pooler.c-13.us-east-1.aws.neon.tech
ep-old-shape-b7dq98pg.c-13.us-east-1.aws.neon.tech
```

Existing custom domain entries include Gateway, Vercel API, mise metadata, MCP and the RealClear site. Verify the actual current policy and request additions through the supported environment configuration workflow if still needed. Do not bypass a denied network policy. Successful SQL through Neon MCP does not verify the application's outbound path.

Next actions:

1. Use the cloud environment skill and status tool to establish the attached configuration, readiness and executor. Compare with the user's selected `tz-trial` profile before requesting another change. No environment-switch or configuration-write tool was available in the previous session.
2. Confirm the intended `.env` file binding or runtime secret injection using names/presence only. Do not dump process environments, secret files, authenticated URLs or raw integration errors.
3. Once available, restart the app process so it loads the current secrets; verify Neon with a small read-only query through the existing driver, and make authenticated MCP discovery through `src/lib/mcp.ts`. Verify actual tool contracts without inventing names or schemas.
4. Recheck Gateway availability/authentication. A model appearing in the catalog does not prove a generation request succeeds.
5. Run the relevant checks and health requests; distinguish shell health, local network/authentication, connector SQL and deployed integration results.

## Neon: already provisioned

Do not create another project or repeat schema setup unnecessarily. Details and scope mapping are in `docs/DATABASE.md`:

- Personal organization **Sasha**, project `tz-chat` / `fancy-base-03274879`, PostgreSQL 17, AWS Northern Virginia.
- Database `tz_chat`, migration owner `tz_chat_owner`.
- Production branch `br-red-cherry-b7aqykv9`; preview branch `br-lucky-cake-b70179mt`.
- Both branches have the baseline `conversations`, `messages`, `datasets` and `schema_migrations` tables. The checksum and initially empty row counts were verified through Neon MCP; baseline reapplication on preview succeeded.
- Preview was branched before production contained application data. Keep production and preview separate. Do not reset preview from a future production database without reviewing the data copied.
- The Vercel plugin was not connected and CLI authentication was absent when last checked. The user subsequently said all environment variables were set, but hosted variable scopes were not independently inspected. Verify them rather than assuming either complete or missing configuration.
- Owner credentials are for explicit migration/admin work. Choose appropriate runtime role permissions when implementing application queries. No application authorization is implemented yet.

## Keep the verified toolchain and build fixes

- Node 24.22.1, npm 12.2.1, optional Vercel CLI 65.2.0 are pinned in `mise.toml`.
- Next.js 16.4.3, ESLint 10.13.0, TypeScript 6.0.3. Next's installed docs/config include ESLint 10 compatibility fixes. Narrow peer overrides select ESLint 10 for React, import and accessibility plugins; negative JSX probes confirmed rules still fire. TypeScript 7 is outside the parser's supported range.
- The optional Vercel CLI moved out of application dependencies into mise. This removes its hosted-install warning and vulnerable dependency tree from the application's audit; it does not patch the separate administration tool's vulnerabilities.
- `scripts/vercel.mjs` translates legacy `npm_config_cache_dir` to npm's supported cache option for install/build children. It formats the deployed `vercel.json`, then runs every verification gate and production build. **Do not exclude `vercel.json` from formatting**; the user explicitly rejected that approach.
- The hosted formatting failure did not reproduce against the committed file. The wrapper handles config normalization without weakening source checks; deliberately malformed source still stopped the build. The exact cause of the hosted config's differing format was not established.
- Vercel automatically handles Next.js build caching. An absent prior cache is informational. Hosted warning logs and cache restoration were not independently inspected after the successful deployment.

Useful commands after inspecting the current environment:

```sh
mise run ci
mise exec -- npm audit
mise run start # production, after a successful build
# Or use mise run dev for editing; check the existing port owner first.
```

In the existing VM, mise was at `/workspace/tooling/bin/mise`, with `MISE_DATA_DIR=/workspace/tooling/mise/data` and `MISE_CACHE_DIR=/workspace/tooling/mise/cache`. Use the project's pinned tools; the default shell's Node/npm differed. `mise run clean` deletes build outputs, so stop the running production server before a future clean rebuild. Avoid killing unrelated processes.

## Remaining product work after integrations are reachable

Follow `docs/PRODUCT_HANDOFF.md` for the complete behavior and acceptance requirements. The first useful slice is a real sourced conversational turn, a context-preserving follow-up, and persisted reopening.

1. Confirm the existing product's end-user identity provider. Keep private endpoints closed until server identity and ownership checks exist; Vercel deployment protection is not end-user auth.
2. Inspect real MCP discovery/results and supported races, dates, units, coverage and sources. Build an allowlisted, bounded retrieval path and deterministic normalization/provenance.
3. Implement authenticated persistence and the turn lifecycle, complete ordered SDK message/tool parts, idempotent request handling and interrupted-turn recovery.
4. Connect Gateway generation/streaming, the composer, useful error/loading states, and grounded prose plus a data-backed table. Charts follow verified table data; no invented poll facts or model-generated executable UI.
5. Persist immutable snapshots and reopen/continue conversations. Verify isolation with two users and representative timeout/retry/empty/malformed-result cases.
6. Obtain the still-pending supplied HTML/styles and verify responsive/keyboard/browser behavior. No browser UI test has been performed yet.
7. Verify actual staged product behavior and a staging URL. Do not equate a successful foundation deployment with completed product delivery.

Suggested next-session prompt:

> Read docs/NEXT_SESSION_HANDOFF.md, AGENTS.md and docs/PRODUCT_HANDOFF.md. First resolve which CloudVM configuration is attached and why the saved tz-trial .env is absent, without exposing credentials or repeating unsupported restart advice. Verify local Neon/MCP/Gateway access, keep the local service running, then proceed toward the first authenticated, sourced conversational slice. Preserve the agreed stack and the verified build fixes.
