# Progress

## Session scope and time

Repository foundation started October 24, 2026, approximately 9:21 a.m. America/Los_Angeles. Prior trial time is unknown; the user was asked asynchronously. This checkpoint is configuration/scaffolding work, not the complete six-hour trial delivery. This foundation checkpoint took approximately 17 minutes (9:21–9:38 a.m.); prior time and the remaining overall trial budget remain unknown.

## Decisions confirmed

- User has created a Vercel project connected to this GitHub repository.
- Use native Vercel Git deployments with checks in the build gate; omit a duplicate GitHub deployment workflow.
- User confirmed Neon Postgres.
- End-user authentication provider and supplied HTML are still unspecified.
- Node 24.22.1 and mise 2026.10.18 were verified against upstream releases. npm is pinned at 12.2.1. TypeScript 6.0.3 is the newest version supported by the installed TypeScript ESLint parser (`<6.1`); upstream TypeScript 7 is not used with an unsupported lint parser. ESLint was initially pinned to 9.39.5 pending verification of Next.js's ESLint 10 compatibility fixes; see the build-warning maintenance below.

## Implemented

Mise tasks, exact package pins and lockfile, Vercel deployment gate, responsive preview shell, safe Markdown/table rendering, AI Gateway and MCP transport factories, credential-safe config validation, and an initial Neon-compatible schema/migration runner.

## Boundaries

At the initial foundation checkpoint, no live model call, MCP discovery, Neon migration, end-user authentication or Vercel deployment had been verified. Later infrastructure verification is recorded below. No polling facts or tool schemas were fabricated. The supplied MCP credential has not been written into repository files.

The cloud proxy denied both the MCP and RealClear reference domains. Required domain additions were saved in the cloud configuration draft but have not yet been observed active. Vercel credentials and environment variables must be configured separately in the linked project.

## Validation

Passed:

- Reusable cloud install script: pinned mise tools and clean `npm ci` installation (736 packages).
- `mise run clean`, formatting, ESLint with zero warnings, and TypeScript checks.
- All 9 focused tests (5 configuration boundary tests and 4 embedded Postgres schema tests).
- `mise run ci`, including the Next.js production build.
- Production server: health JSON and representative rendered page content, source link, and absence of an embedded MCP token.
- Development server: health JSON and rendered preview page. Development server left running on port 3000; production test process stopped.
- Vercel's pinned npm command resolves npm 12.2.1; local Vercel CLI reports 65.2.0.

Initial navigation-lint and test environment typing failures were corrected before the successful final run. Current npm requires explicit dependency install-script permissions; exact esbuild and unrs-resolver versions are approved in package.json and verified through the clean install.

Embedded Postgres tests cover schema constraints, not live Neon connectivity or account-level authorization. No browser interaction or visual screenshot testing was performed. At the end of the foundation checkpoint, no code had been pushed and no remote deployment had been triggered. The subsequent repository publication is recorded in Git history.

Cloud configuration draft saved: install_script, start_skill, and custom network domains for mise metadata, MCP, the RealClear reference site, AI Gateway and Vercel API. The draft requires review/save and publication in environment settings; saving the draft did not apply runtime networking or publish an environment.

## Product handoff and repository publication

The user subsequently authorized pushing the foundation and requested a product-focused follow-up. `docs/PRODUCT_HANDOFF.md` captures the agreed stack, current boundaries, first usable product slice, acceptance scenarios, and remaining integration inputs. This documentation follow-up changes no application behavior. The push targets the existing `main` branch through a normal fast-forward; the connected Vercel project may initiate a build. A successful Git push is not proof of deployment success.

## Deployment dependency maintenance

`vercel.json` remains included in the formatting gate. Running the pinned Prettier on the committed file produces no changes; the reported Vercel formatting failure has not been reproduced locally.

At the initial maintenance checkpoint, direct dependencies were checked against the registry. TypeScript 7 was outside the lint parser's supported range, and ESLint 10 was deferred pending compatibility verification. The lockfile was refreshed, and version-scoped overrides updated Vercel CLI's pinned transitive dependencies within their existing major versions: Ajv, js-yaml, minimatch, path-to-regexp, smol-toml, tar, Undici and Zod. These CLI overrides were subsequently removed when the optional CLI moved out of the application dependency tree.

The full audit fell from 33 findings (12 moderate, 20 high, 1 critical) to 16 (6 moderate, 10 high, 0 critical). Remaining findings originate in the latest Vercel CLI's Zod 3 and Undici 5 dependency trees, including Undici's multipart parser. Updating those to their latest versions within the same major does not clear the advisories. They need upstream fixes or a separately verified major migration; `npm audit fix --force` currently proposes downgrading Vercel CLI to 53.2.0. These findings remain unresolved.

Validation: clean installation with npm 12.2.1 succeeded, followed by formatting, lint, type checking, all 9 tests and a production build. The production-only audit reports zero vulnerabilities. Vercel CLI's version and build help load with the overrides; this does not verify authenticated deployment or every CLI code path.

## Build-warning maintenance

Vercel reported the same formatting failure again for a configuration that passed the local formatter unchanged. The hosted build now explicitly formats its copy of `vercel.json` before running every verification gate. No file was added to `.prettierignore`. The install/build wrapper translates the legacy cache-directory environment option to npm's supported cache option for all child commands. Vercel manages the Next.js build cache automatically; the absence of a previous cache is informational.

The optional Vercel CLI is now pinned through mise instead of being installed with application dependencies. This removes the hosted build's ignored-CLI warning and the CLI's vulnerable dependency tree from the application lockfile. It does not fix vulnerabilities in the separately installed administration tool. The project audit now reports zero vulnerabilities, including development dependencies.

Next.js 16.4.3's installed documentation and configuration include ESLint 10 compatibility fixes for the legacy React/import rule APIs. ESLint was upgraded to 10.13.0. Targeted peer overrides select that version for the import, accessibility and React plugins, whose peer metadata still excludes 10; other plugins already declare support. TypeScript remains at 6.0.3 within the parser's supported range.

Validation: the actual Vercel install wrapper completed a clean npm 12.2.1 install without cache-option or ESLint deprecation warnings. The build wrapper normalized a deliberately minified `vercel.json` and passed formatting, lint, type checks, all 9 tests and the production build. A deliberately unformatted application source file still blocked the build. Separate checks covered uppercase cache-option translation, preservation of an explicit cache location, and stopping after a verification failure. Invalid JSX still triggered accessibility, React Hooks and Next.js lint rules under ESLint 10. The optional CLI installed successfully through mise. Hosted deployment and cache restoration remain unverified locally.

GitHub subsequently reported the Vercel deployment for commit `525e503` as successful. Individual hosted warning output and cache restoration were not inspected.

## Neon provisioning

Created `tz-chat` in the personal Sasha organization, on PostgreSQL 17 in AWS Northern Virginia. Production and preview have separate branches/computes, each sized at 0.25–1 CU. The account rejected a custom suspend interval; provisioning succeeded using account defaults. The initial schema and checksum ledger were installed in production in one transaction, and preview was branched while the database contained no application data. Both branches' table lists, zero row counts and migration checksum were verified through the Neon connection. Reapplying the baseline to preview succeeded.

See `docs/DATABASE.md` for resource IDs and variable scopes. Vercel remains unconnected to Neon: no database credentials were retrieved or written to Vercel or local files. Application runtime database access and authenticated queries remain unverified.

## Local verification and session handoff

Subsequent clean installation and `mise run ci` passed without observed warnings/errors, including all nine tests and the production build. The full dependency audit reports zero vulnerabilities. A production server was started on port 3000, with home and health routes returning HTTP 200. Gateway catalog discovery succeeded and listed `openai/gpt-6.1-sol`; generation was not tested.

Preview database credentials were retrieved through Neon and written only to gitignored, mode-0600 `.env.local`, alongside public model/MCP defaults. No credential values were printed or committed. The application loaded that file. Direct local Neon access encountered proxy denial; `RCP_MCP_TOKEN` remained absent, preventing authenticated MCP discovery.

The user reports saving/publishing a `.env` in the `tz-trial` CloudVM configuration. This chat's connector reported revisions 13 and 14 but no secret-file bindings and only the Gateway key as a runtime variable; readiness/enforcement remained unknown. File searches did not locate the user's `.env`. The connector did not expose the profile display name, so a match to `tz-trial` could not be established. Revision changes alone did not establish that settings were applied. `docs/NEXT_SESSION_HANDOFF.md` records the exact checkpoint, identifiers, missing network access and ordered next steps. Do not repeat claims that the user's settings are definitely unpublished or that restarting will necessarily fix the mismatch.

## Runtime mismatch investigation — October 24, 2026

Resumed from `docs/NEXT_SESSION_HANDOFF.md` after fast-forwarding the clean checkout to the published handoff. The current runtime has all seven configured variables through process injection, without the historical `.env.local`. The attached configuration ID matches; its human-readable name remains unavailable. Connector readiness remains unknown.

Actual factory calls, with the cloud proxy enabled, found MCP HTTP 401 and Gateway HTTP 403 with a billing/credit indication. The Neon HTTP driver targets the regional API host, which is absent from policy; HTTPS CONNECT to that host was rejected with 403. No SQL, schema changes, polling discovery, model response, or hosted product behavior succeeded. See the current handoff for exact safe endpoint details and next actions. Temporary diagnostic code suppressed raw errors and printed only classifications/status; it is not an application feature or a committed fixture.

The scope of this session is the first handoff priority: verify the environment mismatch and identify actionable integration blockers. No secret values were requested or written to configuration files. Remaining overall trial time is still unknown.

Validation: clean pinned `npm ci`, then `mise run ci` passed formatting, zero-warning lint, TypeScript, all 9 tests, and production build. Production shell restarted with `NODE_USE_ENV_PROXY=1 mise run start` on port 3000; `/` and `/api/health` returned HTTP 200. Health still explicitly reports `liveChat: false`. No browser or deployed integration checks were performed. Approximately 6 minutes spent on this investigation and verification; total remaining trial budget remains unknown.

## Access verification — October 24, 2026

Fast-forwarded the clean checkout to `61d9611` and resumed the first priority from `NEXT_SESSION_HANDOFF.md`. Current environment observations establish all seven runtime variables ready and network enforcement active. The previously blocked Neon API host is allowed; an HTTP-driver read-only query returned `tz_chat` and confirmed the conversations, messages and datasets tables. No database writes were made.

MCP initialization through the existing factory still returns HTTP 401. Minimal Gateway generation through the existing factory still returns HTTP 403 with a billing/credit indication. These service-level blockers remain despite ready variable injection. No MCP contracts, polling data, successful generation, authentication or hosted product behavior were verified. See the latest handoff section for the next actions.

Verification: clean `npm ci` and `mise run ci` passed (formatting, lint, TypeScript, 9 tests, production build). Restarted the production shell with `NODE_USE_ENV_PROXY=1 mise run start` on port 3000; `/` and `/api/health` returned HTTP 200, with `liveChat: false`. No browser or hosted integration was verified.

## MCP authentication and identity verified — October 24, 2026

This supersedes the MCP 401 blocker below. The user confirmed Authorization Bearer authentication. The factory now sends the token only in that header; configuration accepts raw tokens or a case-insensitive `Bearer ` prefix, trims surrounding whitespace, and rejects empty/malformed values. Live initialization, tool discovery and `whoami` succeeded through the updated factory.

Discovered tools: `whoami`, `search_races`, `get_race`, `get_race_polls`, `get_race_average_history`, `compare_races`, `list_pollsters`, `get_race_ratings`, `get_rating_changes`, `send_feedback`. Do not expose `send_feedback` automatically: it submits external feedback. Every tool requires a purpose string of at least ten characters; optional purpose_kind accepts research, journalism, campaign, academic, personal or other.

`whoami` returned a successful text content block containing JSON with `account_id`, `token_id`, `token_prefix`, `session_id`, `server`, `client`, `purpose`, `purpose_kind`, and `call_id`, followed by a connection summary. No display name, email, avatar or account permissions were returned. Use the server-validated account ID as the candidate ownership identity; cross-token stability remains untested. Expose only allowlisted UI fields (for example a shortened account ID); keep token metadata and upstream session IDs out of UI/model history. Mint the application's own session cookie. Do not treat client/server names as user names or parse numeric call IDs as exact JavaScript numbers without verifying their representation.

The SDK encountered HTTP 400/405 during negotiation/optional transport requests, but initialization, tools/list and tools/call completed successfully. Polling retrieval itself remains untested. Gateway billing/credit remains a separate blocker.

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

Next: resolve Gateway billing/credit, then wire real polling retrieval and the sourced generation lifecycle. Account-wide session management, automated expired credential/session cleanup, upstream revocation propagation, and hosted verification remain future work. RCP token revocation does not automatically end an existing application session; sessions currently end on application expiry/logout. No account email/name is available from `whoami`.

Final verification: `mise run ci` passed formatting, zero-warning ESLint, TypeScript, all 26 tests and production build. Chromium end-to-end checks passed against real RCP and Neon. The generated browser-test conversation was removed afterward. Session/UI implementation took approximately 15 minutes; earlier trial budget remains unknown.

## Environment-key local verification — October 24, 2026

Re-ran Chromium verification using the existing environment-loaded encryption key; no key was regenerated or exposed. A read of the newly created session/credential record confirmed the stored session identifier is hashed, the token is ciphertext, and AES-GCM decryption with the environment key and owning account ID reproduces the presented token. Only boolean assertions/results were logged.

Real sign-in, invalid-token rejection, HttpOnly persistence with no local storage, save/reload, logout and old-cookie rejection, fresh-sign-in history restoration, cross-origin write rejection, anonymous history denial and 390px layout all passed without browser JavaScript errors. The generated test conversation was removed. `mise run ci` passed all 26 tests, formatting, lint, type checks and production build with no warnings/errors. Local configuration still loads from the existing gitignored `.env.local`; hosted environment provisioning was not changed or verified.

## Removed shared MCP token fallback — October 24, 2026

The application no longer reads `RCP_MCP_TOKEN`. `connectPollingMcp` requires an explicit token argument and fails before opening a transport when it is missing or invalid. MCP validation takes explicit `url`/`token` input rather than defaulting to process environment. Sign-in supplies the submitted token; subsequent authenticated MCP work should use `currentRcpToken()` from the validated session. `.env.example` no longer lists a shared token.

All 29 tests and the production build passed. Regression tests verify missing tokens cannot fall back to an environment credential, caller tokens take precedence, and explicit tokens work with no environment credential. The production server was restarted with `RCP_MCP_TOKEN` unset; its absence was checked using names/presence only, including the local dotenv file. A separate browser test harness supplied the real token as form input. Sign-in, encrypted storage round-trip, cookie persistence, save/reload, logout, old-cookie rejection and fresh-login history restoration passed; the generated test conversation was removed. No shared credential is required by the running application. Cloud/Vercel secret settings were not edited.

## Sign-in origin fallback and safe diagnostics — October 24, 2026

The user reported a generic sign-in failure at `https://tz-chat-alexlopashev-gmailcoms-projects.vercel.app/sign-in`. The previous code required `APP_ORIGIN` before validating the token; absent configuration caused the exact generic error. Local checks had an origin configured and missed that scenario. Hosted root cause is not confirmed: this workspace's proxy rejects CONNECT to the Vercel app hostname with HTTP 403 and Vercel CLI is unauthenticated. GitHub reported the prior deployment successful, which does not verify runtime sign-in.

`APP_ORIGIN` is now optional. The app compares Origin with the request Host and uses HTTPS except on loopback; an explicit override remains available for custom proxies. The request Origin and arbitrary forwarded-host headers cannot define the expected origin. Session-cookie selection uses the same rule for pages and route handlers. Regression tests cover the reported Vercel hostname, missing origin configuration, cross-origin rejection and spoofed forwarded-host headers.

Missing/invalid encryption keys and database failures now have safe operational codes. Sign-in records a stage and reference ID in runtime logs without raw errors, SQL, URLs, token values or encryption keys. A failed sign-in returns the matching reference ID for support. Look for `application_request_failed`, then code/stage: `TOKEN_KEY_MISSING`, `TOKEN_KEY_INVALID`, `DATABASE_NOT_CONFIGURED`, `DATABASE_SCHEMA_MISSING`, `DATABASE_PERMISSION_DENIED`, `DATABASE_UNAVAILABLE`, or `AUTH_ORIGIN_INVALID`. The encryption key still must be 64 hex characters; surrounding whitespace is trimmed without changing the key material.

All 33 tests and production build passed. Chromium sign-in, save/reload, logout, old-cookie rejection and fresh-sign-in history restoration passed with no configured APP_ORIGIN or global MCP token. The actual route also accepted matching hosted Host/Origin headers through input validation (HTTP 400 for empty input) and rejected a different Origin (HTTP 403). No hosted runtime or production key/database configuration was independently verified.

## MCP research agent — October 24, 2026

Connected authenticated chat to the AI SDK multi-step agent and eight discovered read-only RCP tools using each session's stored credential. Added streamed tool progress, sourced prose, persisted full message/tool evidence, published-average tables, code-calculated historical endpoint changes, Stop and Retry. Conversation reservation and per-attempt fencing prevent duplicate/overlapping answers and late retry completion. Applied `0003_generation` to preview and production.

All 42 tests, formatting, zero-warning lint, TypeScript and production build passed. Deterministic model tests exercise actual SDK tool execution, follow-up replay, failure and cancellation; database tests exercise ownership, reservation, retries and stale recovery. Live wrapper discovery exposed eight tools, excluded account/feedback tools, and retrieved a published Maine Senate average with a source URL. Chromium verified production-build login, real Gateway failure persistence, duplicate-free retry, fresh-login history, security boundaries, responsive 390px layout and no JavaScript errors. A separate temporary saved-message fixture rendered the real MCP evidence values and source links correctly; its prose was explicitly a fixture, not live model output. Verification conversations were removed.

Current local AI Gateway requests still fail with HTTP 403 and a billing/credit indication. Successful live answer generation and hosted chat are unverified. No mock fallback exists. The production app remains running locally without `RCP_MCP_TOKEN` or an APP_ORIGIN override; health reports capability, not integration readiness. Restore Gateway access, then verify a live sourced turn and follow-up before calling this end-to-end verified.
