import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";
import { beforeAll, afterAll, it, expect } from "vitest";
import { Repository, type Database } from "../src/lib/repository";
import type { RunUsage } from "../src/lib/usage";
const db = new PGlite();
const repo = new Repository({
  query: async (text, values) => (await db.query(text, values)).rows,
  transaction: async () => [],
} as Database);
beforeAll(async () => {
  for (const path of ["0001_chat", "0006_model_usage"])
    await db.exec(
      await readFile(
        new URL(`../db/migrations/${path}.sql`, import.meta.url),
        "utf8",
      ),
    );
}, 30000);
afterAll(() => db.close());
it("keeps usage per account and attempt, including superseded turns and titles", async () => {
  const conversation = await repo.createConversation("owner-a");
  const run = {
    model: "test",
    elapsedMs: 0,
    toolCalls: 0,
    cachePolicy: "test",
    cacheKey: "test",
    version: 1,
    id: randomUUID(),
    kind: "chat",
    status: "pending",
    startedAt: new Date().toISOString(),
    steps: [],
    startedSteps: 0,
  } as RunUsage;
  await repo.startUsage("owner-a", conversation, run);
  await repo.saveUsage("owner-b", conversation, { ...run, status: "failed" });
  expect(await repo.usage("owner-b", conversation)).toEqual([]);
  expect((await repo.usage("owner-a", conversation))[0].status).toBe("pending");
  await expect(
    repo.startUsage("owner-b", conversation, { ...run, id: randomUUID() }),
  ).rejects.toThrow(/foreign key/i);
  await repo.saveUsage("owner-a", conversation, { ...run, status: "complete" });
  await repo.saveUsage("owner-a", conversation, { ...run, status: "failed" });
  expect((await repo.usage("owner-a", conversation))[0].status).toBe(
    "complete",
  );
  await repo.startUsage("owner-a", conversation, { ...run, id: randomUUID() });
  await repo.startUsage("owner-a", conversation, {
    ...run,
    id: randomUUID(),
    kind: "title",
  });
  expect(await repo.usage("owner-a", conversation)).toHaveLength(3);
  await db.exec(
    "UPDATE model_usage SET updated_at=now()-interval '3 minutes' WHERE status='pending'",
  );
  expect(
    (await repo.usage("owner-a", conversation)).filter(
      (run) => run.status === "interrupted",
    ),
  ).toHaveLength(2);
});
