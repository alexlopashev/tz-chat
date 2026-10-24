import "server-only";
import { neon } from "@neondatabase/serverless";
import type { Database } from "./repository";

export function database(): Database {
  if (!process.env.DATABASE_URL) throw new Error("Database is not configured.");
  const sql = neon(process.env.DATABASE_URL, {
    fetchOptions: { signal: AbortSignal.timeout(15_000) },
  });
  return {
    async query<T>(text: string, values: unknown[] = []) {
      try {
        return (await sql.query(text, values)) as T[];
      } catch {
        throw new Error("Database request failed.");
      }
    },
    async transaction(statements) {
      try {
        return (await sql.transaction(
          statements.map(({ text, values }) => sql.query(text, values ?? [])),
        )) as unknown[][];
      } catch {
        throw new Error("Database transaction failed.");
      }
    },
  };
}
