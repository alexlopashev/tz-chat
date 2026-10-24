import { randomBytes, randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import {
  encryptToken,
  decryptToken,
  newSessionId,
  sessionHash,
} from "../src/lib/auth/crypto";
import { parseIdentity } from "../src/lib/auth/identity";
import { Repository, type Database } from "../src/lib/repository";

const db = new PGlite();
const adapter: Database = {
  async query<T>(text: string, values: unknown[] = []) {
    return (await db.query<T>(text, values)).rows;
  },
  async transaction(statements) {
    return db.transaction(async (tx) => {
      const rows: unknown[][] = [];
      for (const s of statements)
        rows.push((await tx.query(s.text, s.values)).rows);
      return rows;
    });
  },
};
const repo = new Repository(adapter);
const a = randomUUID(),
  b = randomUUID();
const key = randomBytes(32);
const expires = () => new Date(Date.now() + 86400_000);
beforeAll(async () => {
  for (const file of ["0001_chat", "0002_identity"])
    await db.exec(
      await readFile(
        new URL(`../db/migrations/${file}.sql`, import.meta.url),
        "utf8",
      ),
    );
}, 30_000);
afterAll(() => db.close());

describe("Verified RCP identity", () => {
  it("accepts only the service account ID, ignoring token/session/client metadata", () => {
    expect(
      parseIdentity({
        content: [
          {
            type: "text",
            text: JSON.stringify({
              account_id: a,
              token_prefix: "sensitive",
              session_id: "upstream",
              client: { name: "not a user" },
            }),
          },
          { type: "text", text: "Connected." },
        ],
      }),
    ).toEqual({ userId: a });
  });
  it("rejects tool errors, missing identity, malformed UUIDs, and conflicting identities", () => {
    for (const result of [
      {
        isError: true,
        content: [{ type: "text", text: JSON.stringify({ account_id: a }) }],
      },
      { content: [{ type: "text", text: "not JSON" }] },
      {
        content: [
          { type: "text", text: JSON.stringify({ account_id: "invented" }) },
        ],
      },
      {
        content: [
          { type: "text", text: JSON.stringify({ account_id: a }) },
          { type: "text", text: JSON.stringify({ account_id: b }) },
        ],
      },
    ])
      expect(() => parseIdentity(result)).toThrow();
  });
});
describe("Encrypted credential storage", () => {
  it("uses randomized authenticated encryption bound to the user", () => {
    const first = encryptToken("synthetic-token", a, key),
      second = encryptToken("synthetic-token", a, key);
    expect(first).not.toBe(second);
    expect(first).not.toContain("synthetic-token");
    expect(decryptToken(first, a, key)).toBe("synthetic-token");
    expect(() => decryptToken(first, b, key)).toThrow();
    expect(() => decryptToken(first, a, randomBytes(32))).toThrow();
    const parts = first.split(".");
    parts[3] = Buffer.from("tampered").toString("base64url");
    expect(() => decryptToken(parts.join("."), a, key)).toThrow();
  });
});
describe("Account-owned history and revocable sessions (embedded Postgres)", () => {
  it("retains history through logout and a different token/session for the same account", async () => {
    const old = newSessionId(),
      fresh = newSessionId();
    await repo.createSession(
      a,
      sessionHash(old),
      encryptToken("token-one", a, key),
      expires(),
    );
    const chat = await repo.createConversation(a);
    const request = randomUUID();
    expect(
      await repo.saveQuestion(a, chat, "Saved across sessions", request),
    ).toBe(true);
    await repo.saveQuestion(a, chat, "Saved across sessions", request);
    await repo.revokeSession(sessionHash(old));
    expect(await repo.session(sessionHash(old))).toBeNull();
    expect(await repo.credential(sessionHash(old))).toBeNull();
    await repo.createSession(
      a,
      sessionHash(fresh),
      encryptToken("token-two", a, key),
      expires(),
    );
    const user = await repo.session(sessionHash(fresh));
    expect(user?.user_id).toBe(a);
    expect(
      (await repo.conversations(user!.user_id)).some((c) => c.id === chat),
    ).toBe(true);
    expect(
      (await repo.conversation(user!.user_id, chat))?.messages,
    ).toHaveLength(1);
    expect(
      decryptToken(
        (await repo.credential(sessionHash(fresh)))!.token_ciphertext,
        a,
        key,
      ),
    ).toBe("token-two");
    const stored = await db.query<{ id_hash: string }>(
      "SELECT id_hash FROM user_sessions",
    );
    expect(
      stored.rows.every((r) => r.id_hash !== old && r.id_hash !== fresh),
    ).toBe(true);
  });
  it("prevents a second account from reading or adding to the first account’s history", async () => {
    const id = newSessionId();
    await repo.createSession(
      b,
      sessionHash(id),
      encryptToken("token-b", b, key),
      expires(),
    );
    const chat = (await repo.conversations(a))[0];
    expect(await repo.conversations(b)).toHaveLength(0);
    expect(await repo.conversation(b, chat.id)).toBeNull();
    expect(
      await repo.saveQuestion(
        b,
        chat.id,
        "Cross-account attempt",
        randomUUID(),
      ),
    ).toBe(false);
    expect((await repo.conversation(a, chat.id))?.messages).toHaveLength(1);
  });
  it("rejects expired/unknown sessions and revokes a replaced browser session", async () => {
    const old = newSessionId(),
      fresh = newSessionId();
    await repo.createSession(
      a,
      sessionHash(old),
      encryptToken("old", a, key),
      expires(),
    );
    await repo.createSession(
      a,
      sessionHash(fresh),
      encryptToken("new", a, key),
      expires(),
      sessionHash(old),
    );
    expect(await repo.session(sessionHash(old))).toBeNull();
    await db.query(
      "UPDATE user_sessions SET created_at=now()-interval '2 days',expires_at=now()-interval '1 day' WHERE id_hash=$1",
      [sessionHash(fresh)],
    );
    expect(await repo.session(sessionHash(fresh))).toBeNull();
    expect(await repo.session(sessionHash(newSessionId()))).toBeNull();
  });
  it("rejects linking a session to another account’s credential", async () => {
    const credential = (
      await db.query<{ id: string }>(
        "SELECT id FROM rcp_credentials WHERE user_id=$1 LIMIT 1",
        [a],
      )
    ).rows[0].id;
    await expect(
      db.query(
        "INSERT INTO user_sessions(id_hash,user_id,credential_id,expires_at) VALUES ($1,$2,$3,now()+interval '1 day')",
        [sessionHash(newSessionId()), b, credential],
      ),
    ).rejects.toThrow(/foreign key/i);
  });
});
