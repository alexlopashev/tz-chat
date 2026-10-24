import { expect, it } from "vitest";
import { draftKey, readDraft, writeDraft } from "../src/lib/drafts";
function storage() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      values.set(key, value);
    },
    removeItem: (key: string) => {
      values.delete(key);
    },
  };
}
it("isolates accounts and conversations, restores edits, and clears accepted drafts", () => {
  const store = storage(),
    key = draftKey("account-a", "chat-a");
  const draft = {
    text: "Revised question",
    editing: {
      messageId: "message",
      previousRequestId: "request",
      draft: "Earlier unsent draft",
    },
  };
  writeDraft(key, draft, store);
  expect(readDraft(key, store)).toEqual(draft);
  for (const other of [
    draftKey("account-b", "chat-a"),
    draftKey("account-a", "chat-b"),
    draftKey("account-a"),
  ])
    expect(readDraft(other, store)).toBeNull();
  writeDraft(key, null, store);
  expect(readDraft(key, store)).toBeNull();
});
it("tolerates corrupt, expired and unavailable browser storage", () => {
  const store = storage(),
    key = "test";
  for (const value of [
    "broken",
    JSON.stringify({ text: "Old draft", updatedAt: 1 }),
    JSON.stringify({ text: 42, updatedAt: Date.now() }),
  ]) {
    store.setItem(key, value);
    expect(readDraft(key, store)).toBeNull();
  }
  const unavailable = {
    getItem: () => {
      throw new Error();
    },
    setItem: () => {
      throw new Error();
    },
    removeItem: () => {
      throw new Error();
    },
  };
  expect(readDraft(key, unavailable)).toBeNull();
  expect(() =>
    writeDraft(key, { text: "Keep in memory", editing: null }, unavailable),
  ).not.toThrow();
});
