import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, beforeEach, expect, it } from "vitest";
import {
  SharedProtection,
  ProtectionError,
  dependencyOutcome,
} from "../src/lib/protection";
import type { Database } from "../src/lib/repository";
const db = new PGlite();
const source = await readFile(
  new URL("../db/migrations/0005_protection.sql", import.meta.url),
  "utf8",
);
beforeAll(async () => {
  await db.exec(source);
  await db.exec(source);
}, 30000);
beforeEach(async () => {
  await db.exec("TRUNCATE runtime_buckets, runtime_leases, runtime_circuits");
});
afterAll(async () => {
  await db.close();
});
async function admit(owner = "account-a", kind = "chat") {
  const id = randomUUID();
  const { rows } = await db.query<{
    result: { allowed?: boolean; code?: string; retryAfter: number };
  }>("SELECT admit_work($1,$2,$3) AS result", [owner, kind, id]);
  return { id, ...rows[0].result };
}
async function release(id: string) {
  await db.query("DELETE FROM runtime_leases WHERE id=$1", [id]);
}
async function acquire(service = "gateway") {
  const probe = randomUUID();
  const { rows } = await db.query<{
    result: { allowed?: boolean; epoch: number; code?: string };
  }>("SELECT acquire_circuit($1,$2) AS result", [service, probe]);
  return { probe, service, ...rows[0].result };
}
async function finish(p: Awaited<ReturnType<typeof acquire>>, outcome: string) {
  await db.query("SELECT finish_circuit($1,$2,$3,$4)", [
    p.service,
    p.probe,
    p.epoch,
    outcome,
  ]);
}
it("bounds account concurrency across conversations and releases idempotently", async () => {
  const a = await admit(),
    b = await admit();
  expect(a.allowed && b.allowed).toBe(true);
  expect((await admit()).code).toBe("USER_BUSY");
  expect((await admit("account-b")).allowed).toBe(true);
  await release(a.id);
  await release(a.id);
  expect((await admit()).allowed).toBe(true);
});
it("keeps per-account minute and hour budgets after work completes", async () => {
  for (let n = 0; n < 8; n++) await release((await admit()).id);
  const denied = await admit();
  expect(denied.code).toBe("USER_RATE_LIMIT");
  expect(denied.retryAfter).toBeGreaterThan(0);
  await db.exec(
    "UPDATE runtime_buckets SET expires_at=now()-interval '1 second' WHERE key LIKE '%minute%' OR key LIKE 'global:%'",
  );
  await db.exec("UPDATE runtime_buckets SET count=60 WHERE key LIKE '%hour%'");
  expect((await admit()).code).toBe("USER_RATE_LIMIT");
});
it("shares global concurrency across independent accounts and recovers crashed leases", async () => {
  for (let n = 0; n < 20; n++)
    expect((await admit(`user-${n}`)).allowed).toBe(true);
  expect((await admit("new-user")).code).toBe("SERVICE_BUSY");
  await db.exec(
    "UPDATE runtime_leases SET expires_at=now()-interval '1 second'",
  );
  expect((await admit("new-user")).allowed).toBe(true);
});
it("global request rate survives releases; denial does not consume personal quota", async () => {
  for (let n = 0; n < 40; n++) await release((await admit(`user-${n}`)).id);
  expect((await admit("new-user")).code).toBe("SERVICE_BUSY");
  const { rows } = await db.query(
    "SELECT * FROM runtime_buckets WHERE key LIKE '%new-user%'",
  );
  expect(rows).toHaveLength(0);
});
it("titles have an independent lower budget", async () => {
  const a = await admit("owner", "title");
  expect((await admit("owner", "title")).code).toBe("USER_BUSY");
  expect((await admit("owner", "chat")).allowed).toBe(true);
  await release(a.id);
  for (let n = 0; n < 2; n++) await release((await admit("owner", "title")).id);
  expect((await admit("owner", "title")).code).toBe("USER_RATE_LIMIT");
});
it("opens after repeated failures, rejects stale success and allows one recovery probe", async () => {
  const stale = await acquire();
  for (let n = 0; n < 5; n++) await finish(await acquire(), "failure");
  expect((await acquire()).code).toBe("SERVICE_BUSY");
  await finish(stale, "success");
  expect((await acquire()).code).toBe("SERVICE_BUSY");
  expect((await acquire("mcp")).allowed).toBe(true);
  await db.exec(
    "UPDATE runtime_circuits SET opened_until=now()-interval '1 second' WHERE service='gateway'",
  );
  const probe = await acquire();
  expect(probe.allowed).toBe(true);
  expect((await acquire()).code).toBe("SERVICE_BUSY");
  await finish(probe, "success");
  expect((await acquire()).allowed).toBe(true);
});
it("recovers expired probes, fences their late results, and reopens on failed probe", async () => {
  for (let n = 0; n < 5; n++) await finish(await acquire(), "failure");
  await db.exec(
    "UPDATE runtime_circuits SET opened_until=now()-interval '1 second'",
  );
  const old = await acquire();
  await db.exec(
    "UPDATE runtime_circuits SET probe_until=now()-interval '1 second'",
  );
  const next = await acquire();
  await finish(old, "success");
  expect((await acquire()).code).toBe("SERVICE_BUSY");
  await finish(next, "failure");
  expect((await acquire()).code).toBe("SERVICE_BUSY");
});
it("does not count user credentials, invalid requests, cancellations or local throttling as outages", () => {
  for (const status of [400, 401, 403, 404, 422])
    expect(dependencyOutcome({ statusCode: status })).toBe("neutral");
  for (const status of [429, 500, 503])
    expect(dependencyOutcome({ statusCode: status })).toBe("failure");
  expect(dependencyOutcome({ rejected: true })).toBe("neutral");
  expect(
    dependencyOutcome(
      new Error(),
      AbortSignal.abort(new DOMException("Deadline", "TimeoutError")),
    ),
  ).toBe("failure");
  expect(dependencyOutcome({ statusCode: 503 }, AbortSignal.abort())).toBe(
    "neutral",
  );
  expect(dependencyOutcome(new ProtectionError("SERVICE_BUSY", 30))).toBe(
    "neutral",
  );
});
it("fails closed if shared protection cannot be checked", async () => {
  const protection = new SharedProtection({
    query: async () => {
      throw new Error("offline");
    },
  } as unknown as Database);
  await expect(protection.admit("owner", "chat")).rejects.toMatchObject({
    status: 503,
    retryAfter: 15,
    code: "PROTECTION_UNAVAILABLE",
  });
});
