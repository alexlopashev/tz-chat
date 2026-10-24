import { readFile, readdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import { neon } from "@neondatabase/serverless";

const connection =
  process.env.DATABASE_MIGRATION_URL || process.env.DATABASE_URL;
if (!connection)
  throw new Error(
    "Set DATABASE_MIGRATION_URL or DATABASE_URL before migrating.",
  );
const sql = neon(connection);
const versions = (await readdir(new URL("../db/migrations/", import.meta.url)))
  .filter((name) => /^\d{4}_[a-z_]+\.sql$/.test(name))
  .sort();
for (const file of versions) {
  const version = file.slice(0, -4);
  const source = await readFile(
    new URL(`../db/migrations/${version}.sql`, import.meta.url),
    "utf8",
  );
  const checksum = createHash("sha256").update(source).digest("hex");
  const statements = source
    .split("-- statement-breakpoint")
    .map((value) => value.trim())
    .filter(Boolean);
  try {
    await sql.transaction([
      sql`SELECT pg_advisory_xact_lock(hashtext('tz-chat-schema'))`,
      sql`CREATE TABLE IF NOT EXISTS schema_migrations (version text PRIMARY KEY, checksum text NOT NULL, applied_at timestamptz NOT NULL DEFAULT now())`,
      ...statements.map((statement) => sql.query(statement)),
      // Refuse altered baseline contents, including competing migration attempts.
      sql`INSERT INTO schema_migrations (version, checksum) VALUES (${version}, ${checksum})
        ON CONFLICT (version) DO UPDATE SET checksum =
          CASE WHEN schema_migrations.checksum = EXCLUDED.checksum
          THEN schema_migrations.checksum ELSE NULL END`,
    ]);
    console.log(`Applied or verified ${version}.`);
  } catch {
    throw new Error(
      "Migration failed. Check database access and baseline integrity; credentials are not logged.",
    );
  }
}
