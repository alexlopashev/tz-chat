# RealClear conversational polling

A staging demo for exploring polling data through sourced, multi-turn conversations. Built with Next.js, React, Vercel AI SDK, Vercel AI Gateway and Neon Postgres. Users sign in with an existing RCP MCP token; answers use real read-only MCP tools, with saved conversations, evidence drawers, tables and charts.

The RCP + AI launcher opens a resizable chat panel over a labeled landing-page mock. An optional iframe loads the RealClearPolling website; the mock remains available when embedding fails. The backdrop supplies neither credentials nor page context to the agent.

## Components and services

| Component         | Responsibility                                                                                 | Location                                                                                                                                    |
| ----------------- | ---------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| GitHub            | Source, dependency pins, SQL migrations and tests                                              | [alexlopashev/tz-chat](https://github.com/alexlopashev/tz-chat)                                                                             |
| Vercel            | Next.js UI, backend routes, streaming responses and Git deployments                            | [Project](https://vercel.com/alexlopashev-gmailcoms-projects/tz-chat) · [Demo](https://tz-chat-alexlopashev-gmailcoms-projects.vercel.app/) |
| Neon              | Accounts, encrypted credentials, browser sessions, conversations and shared request protection | [Postgres project](https://console.neon.tech/app/projects/fancy-base-03274879)                                                              |
| RCP MCP           | Verifies an existing RCP identity and supplies polling data through the user's token           | `https://rcp.tazalabs.ai/mcp`                                                                                                               |
| Vercel AI Gateway | Authenticated model access for research and title generation                                   | [`src/lib/gateway.ts`](src/lib/gateway.ts)                                                                                                  |
| Vercel AI SDK     | Browser streaming state, server model/tool loop and structured message parts                   | [`src/lib/agent`](src/lib/agent)                                                                                                            |

Read [Architecture](docs/ARCHITECTURE.md) for authentication, database structure, per-turn execution, caching, reliability and memory extension points.

## Run locally

Install [mise](https://mise.jdx.dev/getting-started.html), then:

```sh
mise trust
mise install
mise run install
cp .env.example .env.local # only if .env.local does not already exist
# Fill in the server-side settings below.
mise run db:migrate      # verify the target database before running
mise run dev
```

The app runs at `http://localhost:3000`. Open RCP + AI and paste a valid RCP token; an optional `Bearer ` prefix is accepted. No application-wide `RCP_MCP_TOKEN` variable is used.

`mise.toml` pins Node 24.22.1 and npm 12.2.1; application dependencies are pinned in `package.json` and `package-lock.json`.

| Variable                   | Purpose                                                                                            |
| -------------------------- | -------------------------------------------------------------------------------------------------- |
| `DATABASE_URL`             | Neon TLS connection for the intended environment, normally pooled                                  |
| `DATABASE_MIGRATION_URL`   | Optional direct connection for explicit migrations; falls back to `DATABASE_URL`                   |
| `RCP_TOKEN_ENCRYPTION_KEY` | 32 random bytes encoded as 64 hex characters; encrypts stored MCP tokens                           |
| `AI_GATEWAY_MODEL`         | Research model ID; `.env.example` uses `openai/gpt-6.1-sol`                                        |
| `AI_GATEWAY_API_KEY`       | Gateway authentication for local execution; supported Vercel OIDC can supply hosted authentication |
| `RCP_MCP_URL`              | RCP endpoint above; the application validates this exact endpoint                                  |
| `APP_ORIGIN`               | Optional strict origin override for a custom proxy; otherwise derived from the request host        |

Set secrets through Vercel's environment settings for each environment. Keep the encryption key stable within an environment and consistent across its instances; use different keys for isolated environments. Rotating it requires re-encrypting stored credentials or reconnecting affected users. Never commit `.env.local` or expose credentials through `NEXT_PUBLIC_` variables. Environments requiring Node's HTTP proxy support may need `NODE_USE_ENV_PROXY=1`; this is not an application credential.

## Deployments and migrations

Vercel's native GitHub integration deploys `main` to production and branches/PRs to previews. `vercel.json` delegates installation/builds to `scripts/vercel.mjs`; deployment gates run formatting, lint, type checking, tests and a Next.js production build. No separate GitHub Actions deployment workflow is needed. Branch protection is a separate GitHub setting.

| Environment | Neon branch                               | Configuration                                     |
| ----------- | ----------------------------------------- | ------------------------------------------------- |
| Production  | `production` · `br-red-cherry-b7aqykv9`   | Production-scoped database URL and encryption key |
| Preview     | `preview` · `br-lucky-cake-b70179mt`      | Preview-scoped database URL and encryption key    |
| Development | Preview or a dedicated development branch | Local settings for the chosen branch              |

The Neon project is `fancy-base-03274879`, database `tz_chat`, PostgreSQL 17 in AWS Northern Virginia. Environment separation depends on the configured database URL; a Vercel preview does not automatically create its own Neon branch. Do not share production credentials with untrusted previews.

Migrations in [`db/migrations`](db/migrations) run explicitly with `mise run db:migrate`, never during deployment builds. The runner uses a transaction, advisory lock and checksum ledger. Apply all migrations, currently through `0005_protection`, before serving this version. Add new versioned migrations instead of modifying applied files.

## Checks and operations

| Command                             | Purpose                                                                     |
| ----------------------------------- | --------------------------------------------------------------------------- |
| `mise run ci`                       | Formatting, lint, type checking, tests and production build                 |
| `mise run check`                    | Type checking and tests                                                     |
| `mise run lint`                     | ESLint with zero warnings allowed                                           |
| `mise run format`                   | Format source and documentation                                             |
| `mise run build` / `mise run start` | Build and run the production app locally                                    |
| `mise run clean`                    | Remove generated build/test outputs, retaining credentials and dependencies |

`GET /api/health` checks the web process only. Its `integrations: "not-probed"` response does not establish database, MCP or model readiness.

Tests cover identity/session boundaries, ownership constraints, retry fencing, tool execution/history replay, failure handling, shared admission/circuit recovery and draft storage. Local production-browser verification has exercised real sign-in, MCP-backed answers, saved history, edit/stop/retry, throttling, draft restoration, responsive layout and evidence drawers. Eight overlapping Neon transactions verified the per-account concurrency boundary. These checks are not a load/soak test or proof of hosted end-to-end availability.

## Current limits

This is a focused staging demo. History is replayed rather than summarized; long chats hit a context-size limit. There is no cross-chat user memory, durable background execution, stream reconnection, automated credential retention cleanup or measured prompt-cache hit rate. Shared chat/title limits do not protect anonymous sign-in or every inexpensive endpoint. The supplied website HTML was not integrated; the UI follows the supplied visual reference, and successful live iframe rendering is not guaranteed.

Before public launch, prioritize token-aware context management, operational metrics, provider-quota/load testing, edge abuse protection and data-retention controls. Detailed boundaries and extension points are in [Architecture](docs/ARCHITECTURE.md).
