# Repository foundation

## Decisions

- Next.js App Router, React, TypeScript; Vercel hosting; Node 24.22.1.
- Vercel AI SDK with AI Gateway for model calls. A bounded server-side tool loop is the next application increment.
- Neon Postgres through Vercel Marketplace for durable conversations, ordered SDK message parts, and immutable dataset snapshots. Never use local SQLite for deployed persistence.
- Server-resolved end-user identity is mandatory for private data. Vercel deployment protection is not application authentication. No anonymous production fallback.
- Stream prose and render validated React components for tables/charts. Numbers and provenance must come from retrieved datasets, never model-authored chart arrays.
- RealClear-inspired restrained typography, red accents, tables and source links; replaceable CSS pending supplied HTML.

## Scope of this increment

Tooling, CI and gated deployment, runnable shell, configuration boundaries, initial database schema, and focused checks. The attached handoff is background context, not a request to implement every trial requirement now.

## Integration gates

Configure Vercel project/team, deployment credentials, AI Gateway, Neon and an end-user identity provider. Inspect actual MCP discovery and result schemas before implementing polling adapters. Supplied HTML remains outstanding.

## Follow-on priorities

1. Authenticate users and verify owner isolation with two accounts.
2. Inspect real MCP contracts; implement sourced retrieval and bounded tool execution.
3. Persist complete ordered message/tool history; handle retries, concurrent requests and interrupted turns.
4. Add dataset-bound rich views and test numeric parity and provenance.
5. Verify live follow-ups, reload, and failure handling in staging.

## Deliberate omissions

No invented polling data, no claimed live chat, no multi-agent orchestration, no vector database, no account registration, and no automatic production migrations.
