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
