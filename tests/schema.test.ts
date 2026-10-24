import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const db = new PGlite();
const conversation = randomUUID();
const migration = await readFile(
  new URL("../db/migrations/0001_chat.sql", import.meta.url),
  "utf8",
);

beforeAll(async () => {
  await db.exec(migration);
  await db.query("INSERT INTO conversations (id, owner_id) VALUES ($1, $2)", [
    conversation,
    "owner-a",
  ]);
}, 30_000);
afterAll(async () => {
  await db.close();
});

async function insertMessage(
  owner: string,
  sequence: number,
  status = "complete",
) {
  return db.query(
    "INSERT INTO messages (id, conversation_id, owner_id, sequence, request_id, role, parts_json, status) VALUES ($1, $2, $3, $4, $5, 'assistant', $6, $7)",
    [
      randomUUID(),
      conversation,
      owner,
      sequence,
      randomUUID(),
      JSON.stringify([
        { type: "text", text: "Preserved text" },
        {
          type: "tool-example",
          toolCallId: "call-1",
          state: "output-available",
          input: {},
          output: { datasetId: "snapshot-1" },
        },
      ]),
      status,
    ],
  );
}

describe("Postgres schema constraints (embedded Postgres, not a live Neon connection)", () => {
  it("can reapply the initial schema without losing data", async () => {
    await db.exec(migration);
    const result = await db.query(
      "SELECT id FROM conversations WHERE owner_id = $1",
      ["owner-a"],
    );
    expect(result.rows).toHaveLength(1);
  });
  it("rejects message and dataset ownership inconsistent with the parent", async () => {
    await expect(insertMessage("owner-b", 0)).rejects.toThrow(/foreign key/i);
    await expect(
      db.query(
        "INSERT INTO datasets (id, conversation_id, owner_id, kind, snapshot_json, metadata_json) VALUES ($1, $2, 'owner-b', 'individual_polls', '{}', '{}')",
        [randomUUID(), conversation],
      ),
    ).rejects.toThrow(/foreign key/i);
  });
  it("retains ordered rich message parts and prevents duplicate sequence numbers", async () => {
    await insertMessage("owner-a", 1);
    const result = await db.query<{ parts_json: { type: string }[] }>(
      "SELECT parts_json FROM messages WHERE conversation_id = $1 ORDER BY sequence",
      [conversation],
    );
    expect(result.rows[0].parts_json.map((part) => part.type)).toEqual([
      "text",
      "tool-example",
    ]);
    await expect(insertMessage("owner-a", 1)).rejects.toThrow(/unique/i);
  });
  it("permits only one pending assistant turn per conversation", async () => {
    await insertMessage("owner-a", 2, "pending");
    await expect(insertMessage("owner-a", 3, "pending")).rejects.toThrow(
      /unique/i,
    );
    await db.query(
      "UPDATE messages SET status = 'interrupted' WHERE conversation_id = $1 AND status = 'pending'",
      [conversation],
    );
    await expect(insertMessage("owner-a", 3, "pending")).resolves.toBeDefined();
  });
});
