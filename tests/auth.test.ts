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
  for (const file of [
    "0001_chat",
    "0002_identity",
    "0003_generation",
    "0004_chat_preferences",
  ])
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

describe("Database-backed generation lifecycle", () => {
  it("reserves once, rejects concurrent sends, and replays a completed request without duplicating it", async () => {
    const owner = "generation-owner",
      chat = await repo.createConversation(owner),
      request = randomUUID();
    const first = await repo.reserveTurn(
      owner,
      chat,
      "First question",
      request,
    );
    expect(first.kind).toBe("reserved");
    if (first.kind !== "reserved") throw new Error("Not reserved");
    expect(
      (await repo.reserveTurn(owner, chat, "First question", request)).kind,
    ).toBe("busy");
    expect(
      (await repo.reserveTurn(owner, chat, "Other question", randomUUID()))
        .kind,
    ).toBe("busy");
    expect((await repo.conversation(owner, chat))?.messages).toHaveLength(2);
    await repo.finishTurn(
      owner,
      chat,
      first.assistantId,
      first.generationId,
      [{ type: "text", text: "Synthetic answer" }],
      "complete",
    );
    expect(
      (await repo.reserveTurn(owner, chat, "First question", request)).kind,
    ).toBe("complete");
    expect(
      (await repo.reserveTurn(owner, chat, "Changed content", request)).kind,
    ).toBe("conflict");
    expect((await repo.conversation(owner, chat))?.messages).toHaveLength(2);
  });
  it("retries failed turns with a new attempt ID and rejects late completion from the old attempt", async () => {
    const owner = "retry-owner",
      chat = await repo.createConversation(owner),
      request = randomUUID();
    const first = await repo.reserveTurn(owner, chat, "Retry me", request);
    if (first.kind !== "reserved") throw new Error("Not reserved");
    await repo.finishTurn(
      owner,
      chat,
      first.assistantId,
      first.generationId,
      [],
      "failed",
    );
    const second = await repo.reserveTurn(owner, chat, "Retry me", request);
    expect(second.kind).toBe("reserved");
    if (second.kind !== "reserved") throw new Error("Not reserved");
    expect(
      await repo.finishTurn(
        owner,
        chat,
        first.assistantId,
        first.generationId,
        [],
        "complete",
      ),
    ).toBe(false);
    expect(
      await repo.finishTurn(
        owner,
        chat,
        second.assistantId,
        second.generationId,
        [{ type: "text", text: "Recovered" }],
        "complete",
      ),
    ).toBe(true);
    expect((await repo.conversation(owner, chat))?.messages).toHaveLength(2);
  });
  it("recovers stale pending turns, and refuses another account's reserve or completion", async () => {
    const owner = "stale-owner",
      chat = await repo.createConversation(owner),
      request = randomUUID();
    const first = await repo.reserveTurn(owner, chat, "Recover me", request);
    if (first.kind !== "reserved") throw new Error("Not reserved");
    expect(
      (await repo.reserveTurn("other-account", chat, "Recover me", request))
        .kind,
    ).toBe("not-found");
    expect(
      await repo.finishTurn(
        "other-account",
        chat,
        first.assistantId,
        first.generationId,
        [],
        "complete",
      ),
    ).toBe(false);
    await db.query(
      "UPDATE messages SET generation_started_at=now()-interval '3 minutes' WHERE id=$1",
      [first.assistantId],
    );
    expect(
      (await repo.conversation(owner, chat))?.messages.at(-1)?.status,
    ).toBe("interrupted");
    expect(
      (await repo.reserveTurn(owner, chat, "Recover me", request)).kind,
    ).toBe("reserved");
  });
});

describe("Editing the last question", () => {
  it("atomically replaces the last turn, preserves prior context and rejects late completion", async () => {
    const owner = "edit-owner",
      chat = await repo.createConversation(owner);
    const firstRequest = randomUUID();
    const first = await repo.reserveTurn(
      owner,
      chat,
      "Earlier question",
      firstRequest,
    );
    if (first.kind !== "reserved") throw new Error("Not reserved");
    await repo.finishTurn(
      owner,
      chat,
      first.assistantId,
      first.generationId,
      [{ type: "text", text: "Earlier answer" }],
      "complete",
    );
    const oldRequest = randomUUID();
    const old = await repo.reserveTurn(
      owner,
      chat,
      "Original question",
      oldRequest,
    );
    if (old.kind !== "reserved") throw new Error("Not reserved");
    await repo.finishTurn(
      owner,
      chat,
      old.assistantId,
      old.generationId,
      [{ type: "text", text: "Original answer" }],
      "complete",
    );
    const revision = randomUUID(),
      edit = { messageId: oldRequest, previousRequestId: oldRequest };
    const revised = await repo.reserveTurn(
      owner,
      chat,
      "Revised question",
      revision,
      edit,
    );
    expect(revised.kind).toBe("reserved");
    if (revised.kind !== "reserved") throw new Error("Not reserved");
    const saved = (await repo.conversation(owner, chat))!.messages;
    expect(saved).toHaveLength(4);
    expect(saved[1].parts_json).toEqual([
      { type: "text", text: "Earlier answer" },
    ]);
    expect(saved[2]).toMatchObject({
      id: oldRequest,
      request_id: revision,
      parts_json: [{ type: "text", text: "Revised question" }],
    });
    expect(saved[3].parts_json).toEqual([]);
    expect(
      await repo.finishTurn(
        owner,
        chat,
        old.assistantId,
        old.generationId,
        [],
        "complete",
      ),
    ).toBe(false);
    expect(
      (await repo.reserveTurn(owner, chat, "Revised question", revision, edit))
        .kind,
    ).toBe("busy");
    await repo.finishTurn(
      owner,
      chat,
      revised.assistantId,
      revised.generationId,
      [{ type: "text", text: "Revised answer" }],
      "complete",
    );
    expect(
      (await repo.reserveTurn(owner, chat, "Revised question", revision, edit))
        .kind,
    ).toBe("complete");
    expect(
      (await repo.reserveTurn(owner, chat, "Stale edit", randomUUID(), edit))
        .kind,
    ).toBe("busy");
    expect((await repo.conversation(owner, chat))!.messages).toHaveLength(4);
  });
  it("rejects other owners, older questions and active turns, and updates the first-question title", async () => {
    const owner = "guarded-edit",
      chat = await repo.createConversation(owner),
      request = randomUUID();
    const turn = await repo.reserveTurn(owner, chat, "Original title", request);
    if (turn.kind !== "reserved") throw new Error("Not reserved");
    const edit = { messageId: request, previousRequestId: request };
    expect(
      (await repo.reserveTurn(owner, chat, "Active edit", randomUUID(), edit))
        .kind,
    ).toBe("busy");
    await repo.finishTurn(
      owner,
      chat,
      turn.assistantId,
      turn.generationId,
      [],
      "failed",
    );
    expect(
      (
        await repo.reserveTurn(
          "other-owner",
          chat,
          "Foreign edit",
          randomUUID(),
          edit,
        )
      ).kind,
    ).toBe("not-found");
    const revision = randomUUID();
    const updated = await repo.reserveTurn(
      owner,
      chat,
      "Updated title",
      revision,
      edit,
    );
    if (updated.kind !== "reserved") throw new Error("Not reserved");
    expect((await repo.conversation(owner, chat))!.title).toBe("Updated title");
    await repo.finishTurn(
      owner,
      chat,
      updated.assistantId,
      updated.generationId,
      [],
      "complete",
    );
    const next = await repo.reserveTurn(
      owner,
      chat,
      "Newer question",
      randomUUID(),
    );
    if (next.kind !== "reserved") throw new Error("Not reserved");
    await repo.finishTurn(
      owner,
      chat,
      next.assistantId,
      next.generationId,
      [],
      "complete",
    );
    expect(
      (
        await repo.reserveTurn(owner, chat, "Edit older", randomUUID(), {
          messageId: request,
          previousRequestId: revision,
        })
      ).kind,
    ).toBe("busy");
    expect(
      (await repo.conversation(owner, chat))!.messages[0].parts_json,
    ).toEqual([{ type: "text", text: "Updated title" }]);
  });
});

describe("Chat organization", () => {
  it("sorts by message activity while pinning and renaming do not bump recency", async () => {
    const owner = "organization-owner",
      older = await repo.createConversation(owner),
      newer = await repo.createConversation(owner);
    await repo.saveQuestion(owner, older, "Older chat", randomUUID());
    await repo.saveQuestion(owner, newer, "Newer chat", randomUUID());
    await db.query(
      "UPDATE messages SET created_at=now()-interval '2 days' WHERE conversation_id=$1",
      [older],
    );
    await db.query(
      "UPDATE messages SET created_at=now()-interval '1 day' WHERE conversation_id=$1",
      [newer],
    );
    await repo.pinConversation(owner, older, true);
    await repo.renameConversation(owner, older, "Favourite research");
    expect((await repo.conversations(owner)).map((chat) => chat.id)).toEqual([
      newer,
      older,
    ]);
    expect((await repo.conversation(owner, older))!.pinned_at).not.toBeNull();
    expect(await repo.pinConversation("other", older, false)).toBe(false);
    expect(await repo.renameConversation("other", older, "Unauthorized")).toBe(
      false,
    );
    await repo.saveQuestion(owner, older, "New activity", randomUUID());
    expect((await repo.conversations(owner))[0].id).toBe(older);
    await repo.pinConversation(owner, older, false);
    expect((await repo.conversation(owner, older))!.pinned_at).toBeNull();
  });
  it("keeps manual titles through edits and rejects stale generated title writes", async () => {
    const owner = "title-owner",
      id = await repo.createConversation(owner),
      request = randomUUID();
    const turn = await repo.reserveTurn(owner, id, "First question", request);
    if (turn.kind !== "reserved") throw new Error("Not reserved");
    await repo.finishTurn(
      owner,
      id,
      turn.assistantId,
      turn.generationId,
      [],
      "complete",
    );
    const before = (await repo.conversation(owner, id))!;
    await repo.renameConversation(owner, id, "My research");
    expect(
      await repo.setGeneratedTitle(
        owner,
        id,
        "Stale generated name",
        before.title_revision,
      ),
    ).toBe(false);
    const manual = (await repo.conversation(owner, id))!;
    expect(
      await repo.setGeneratedTitle(
        owner,
        id,
        "Automatic overwrite",
        manual.title_revision,
        true,
      ),
    ).toBe(false);
    await repo.reserveTurn(owner, id, "Revised first question", randomUUID(), {
      messageId: request,
      previousRequestId: request,
    });
    expect((await repo.conversation(owner, id))!.title).toBe("My research");
    const revised = (await repo.conversation(owner, id))!;
    expect(
      await repo.setGeneratedTitle(
        "other",
        id,
        "Wrong owner",
        revised.title_revision,
      ),
    ).toBe(false);
    expect(
      await repo.setGeneratedTitle(
        owner,
        id,
        "Explicit regeneration",
        revised.title_revision,
      ),
    ).toBe(true);
    expect((await repo.conversation(owner, id))!.title_source).toBe(
      "generated",
    );
  });
});
