# RealClear conversational polling foundation

Next.js + React + Vercel AI SDK, with Vercel AI Gateway and Neon Postgres selected for deployment. This is a runnable **foundation preview**, not a working polling agent. The shell contains no fabricated poll data. Supplied HTML and an end-user authentication provider are still pending.

For the next implementation session, start with [the product handoff](docs/PRODUCT_HANDOFF.md). It captures the user journey, priorities, acceptance checks, and remaining inputs without reopening infrastructure decisions.

## Local development

Install [mise](https://mise.jdx.dev/getting-started.html) **2026.10.18 or newer**, inspect `mise.toml`, then:

```sh
mise trust
mise install
mise run install
cp .env.example .env.local # only when this file does not already exist
mise run dev
```

`mise.toml` pins Node **24.22.1** and npm **12.2.1**. Its `min_version` is the latest mise release verified during setup, not a Node version range. TypeScript, Vercel CLI, and other project tools are exact dependencies in `package.json` and `package-lock.json`, installed by `mise run install`. TypeScript and ESLint use the latest versions compatible with Next.js’s current lint plugins (see `docs/PROGRESS.md`). This keeps the CLI and compiler identical in local work and deployment, instead of maintaining competing global installations. Run `mise exec -- npm exec -- vercel --version` to verify the CLI.

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

After startup, `GET /api/health` returns `{"status":"ok","scope":"web-shell","liveChat":false}`. This checks the shell only, not model, database or MCP readiness.

## Vercel native Git deployments

The project is already connected to GitHub. **No second GitHub Actions deployment workflow is needed.** Vercel builds previews for branches/PRs and production for its configured production branch (`main`).

`vercel.json` pins the installation command to npm 12.2.1 and makes `npm run verify && npm run build` the deployment gate. Formatting, lint, typecheck or test failures cause the Vercel build to fail; the existing successful production deployment remains active. This gate runs inside Vercel, not as a separate GitHub Actions job. Enable the Vercel status check in GitHub branch protection if merges must also be gated. Vercel does not run mise: it selects Node 24 from `engines`; its managed patch must satisfy the declared minimum 24.22.1. If its runtime lags, the strict install will stop rather than silently use an older version.

In Vercel settings, verify root directory is the repository root, framework is Next.js, production branch is `main`, Node is 24.x, and repository build/install commands are not overridden. Do not configure `output: export`; the application will need server-side routes.

No deploy token is required in GitHub for native integration. Keep production data isolated from previews: connect separate Neon database branches and scope Vercel environment variables to Preview/Production. Never expose production credentials to untrusted fork previews.

## Neon persistence

Add **Neon Postgres** through Vercel Marketplace. Set the pooled, TLS-enabled connection as `DATABASE_URL`; optionally set a direct `DATABASE_MIGRATION_URL` for explicit migrations. Use `vercel env pull .env.local` only after linking and choosing the intended environment, and preserve any existing local configuration first.

Run `mise run db:migrate` against a reviewed target. The initial migration is transactional and repeatable; a checksum rejects modifications to an already-applied baseline. Make future schema changes as new versioned migrations instead of editing the baseline. Review migration strategy before adding those versions. Migrations are intentionally excluded from ordinary builds to avoid simultaneous previews mutating production state.

The schema stores conversations, full ordered SDK message parts, and dataset snapshots. Composite owner foreign keys prevent mismatched parent/child owners. Unique request/role and sequence keys support retry handling; a partial unique index reserves one pending assistant turn per conversation. **These constraints are not authorization.** There are no private API endpoints yet. Every future query must use a verified server identity and scope by owner; never trust a client-provided owner. Snapshot immutability, atomic turn reservation, stale-turn recovery and account isolation still need application implementation and integration tests.

## AI Gateway and MCP

Set `AI_GATEWAY_MODEL` to a model available to your Vercel Gateway account. The example is a configurable starting point, not a claim about model availability. For local use, set `AI_GATEWAY_API_KEY`; Vercel-hosted calls may use supported Vercel OIDC. `src/lib/gateway.ts` creates the AI SDK model through Gateway rather than calling provider endpoints directly. Gateway also offers an OpenAI-compatible Chat Completions API; this app uses its native AI SDK provider so streamed message/tool parts stay typed. No model calls have been exercised yet.

Set `RCP_MCP_URL=https://rcp.tazalabs.ai/mcp` and the supplied credential separately as `RCP_MCP_TOKEN` in server-only environment settings. Never commit the token, include it in a client bundle, or log authenticated URLs. The transport factory uses the server's supplied query-token convention. Actual MCP discovery, tool names, request/result schemas, source semantics and timeout handling remain unverified; no invented tool schema or silent mock fallback is present. Treat MCP content as untrusted data, and inspect/allowlist tools before exposing them to a model.

The cloud environment initially denied access to the MCP and RealClear reference domains. Network additions have been saved in its draft; applying them is separate from Vercel configuration. The page styling is provisional, not a verified reproduction of the inaccessible reference or of the pending HTML.

## Authentication and rich answers

Vercel deployment protection is **not end-user authentication**. Choose and connect the existing product's OIDC/identity provider before enabling private conversation routes. This foundation has no anonymous production fallback or client-supplied identity path.

The preview uses replaceable CSS and a safe Markdown renderer with GFM tables, raw HTML disabled, images disabled, and safe external-link handling. Charts and data-driven views are follow-on work: bind React components to server-owned dataset snapshots; derive numbers, units and coverage in code; preserve provenance. Model text must never become executable JSX/HTML or independently supply chart numbers.

## Validation and remaining scope

`mise run ci` runs formatting, ESLint, type checking, configuration boundary tests, embedded Postgres schema tests, and the Next.js production build. Embedded Postgres tests do not establish live Neon connectivity or authenticated account isolation. See [docs/OUTLINE.md](docs/OUTLINE.md) for the follow-on scope and [docs/PROGRESS.md](docs/PROGRESS.md) for actual validation and time accounting.

Live chat, MCP retrieval, durable user-facing conversation CRUD, authenticated streaming, charts, supplied HTML integration and a verified staging deployment are not complete in this foundation.
