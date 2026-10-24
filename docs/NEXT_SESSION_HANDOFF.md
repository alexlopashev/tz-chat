# Next session handoff

Updated October 24, 2026. Start with this file for current infrastructure state, then read `docs/PRODUCT_HANDOFF.md` for the product requirements and acceptance checks. This file supersedes older statements about unprovisioned databases, unsupported ESLint 10, and unverified deployment/model availability.

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
