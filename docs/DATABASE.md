# Neon database

Provisioned October 24, 2026 in the personal **Sasha** organization (`org-restless-water-13658123`).

| Setting           | Value                                                          |
| ----------------- | -------------------------------------------------------------- |
| Project           | `tz-chat` (`fancy-base-03274879`)                              |
| Console           | https://console.neon.tech/app/projects/fancy-base-03274879     |
| Region            | AWS Northern Virginia (`aws-us-east-1`)                        |
| PostgreSQL        | 17                                                             |
| Database          | `tz_chat`                                                      |
| Migration owner   | `tz_chat_owner`                                                |
| Production branch | `production` (`br-red-cherry-b7aqykv9`)                        |
| Preview branch    | `preview` (`br-lucky-cake-b70179mt`)                           |
| Compute range     | 0.25–1 CU per endpoint; suspend behavior uses account defaults |

Both branches contain the empty `conversations`, `messages`, `datasets` and `schema_migrations` tables. Preview was created from production immediately after schema initialization, before any application data existed. Subsequent writes to each branch are independent. Recreating preview from production later would copy production data, so do not do that without reviewing the data involved.

The `0001_chat` migration was applied transactionally with the repository runner's advisory lock and checksum ledger. Both branches report SHA-256 `7233b316e417fce646c61d6697b7702e47df7b4d2437967d5cc7d6d1e03787ca`. Reapplying the baseline to preview succeeded. This verifies hosted schema setup and repeatability, not authenticated application access.

## Pending Vercel connection

The Neon project was created through Neon directly. Vercel environment configuration has not been independently verified; the user reports configuring variables in CloudVM settings, whose application to this chat's runtime remains unresolved. Preview pooled/direct connections have since been written to a gitignored local `.env.local`. Direct local Neon access was denied by the network proxy. See `NEXT_SESSION_HANDOFF.md` for current evidence and the required hostnames.

| Vercel scope | Neon branch                                | Variables                               |
| ------------ | ------------------------------------------ | --------------------------------------- |
| Production   | `production`                               | Pooled TLS connection as `DATABASE_URL` |
| Preview      | `preview`                                  | Pooled TLS connection as `DATABASE_URL` |
| Development  | `preview` or a separate development branch | Pooled TLS connection as `DATABASE_URL` |

Use a direct TLS connection as `DATABASE_MIGRATION_URL` only in the environment where explicit migrations run. Keep that credential out of Git and avoid putting an owner credential in client-side variables. Runtime access should use a role with the permissions needed by the implemented queries. App queries and authentication are not implemented yet.

After configuring variables, redeploy Vercel and verify database access from the intended runtime. The current `/api/health` checks only the web shell. Migrations remain an explicit operation, never a build step.

## Session and identity migration

On October 24, 2026, `0002_identity` was tested on `preview` and applied through the repository runner to the configured `production` branch. `ep-solitary-pine-b7cz50n4` was verified against Neon endpoint metadata as production. The migration adds `app_users`, `rcp_credentials`, and `user_sessions`; conversation owner IDs are verified RCP account IDs. Existing chat/message/dataset schemas remain intact. See `NEXT_SESSION_HANDOFF.md` for local configuration and verification.
