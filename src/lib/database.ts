import "server-only";
import { ServiceError } from "./service-error";
import { neon } from "@neondatabase/serverless";
import type { Database } from "./repository";

export function database(): Database {
  if (!process.env.DATABASE_URL)
    throw new ServiceError("DATABASE_NOT_CONFIGURED");
  const connection = process.env.DATABASE_URL;
  const client = () =>
    neon(connection, {
      fetchOptions: { signal: AbortSignal.timeout(15_000) },
    });
  return {
    async query<T>(text: string, values: unknown[] = []) {
      try {
        return (await client().query(text, values)) as T[];
      } catch (error) {
        throw databaseError(error);
      }
    },
    async transaction(statements) {
      try {
        const sql = client();
        return (await sql.transaction(
          statements.map(({ text, values }) => sql.query(text, values ?? [])),
        )) as unknown[][];
      } catch (error) {
        throw databaseError(error);
      }
    },
  };
}

function databaseError(error: unknown) {
  const code =
    error && typeof error === "object" && "code" in error
      ? error.code
      : undefined;
  return new ServiceError(
    code === "42P01"
      ? "DATABASE_SCHEMA_MISSING"
      : code === "42501"
        ? "DATABASE_PERMISSION_DENIED"
        : "DATABASE_UNAVAILABLE",
  );
}
