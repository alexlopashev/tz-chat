export type DraftEdit = {
  messageId: string;
  previousRequestId: string;
  draft: string;
};
export type ChatDraft = { text: string; editing: DraftEdit | null };
type DraftStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;
export function draftKey(userId: string, conversationId?: string) {
  return `rcp:chat-draft:v1:${encodeURIComponent(userId)}:${conversationId ?? "new"}`;
}
/** Browser storage is opportunistic: private mode, quota and corrupt data never block chat. */
export function readDraft(
  key: string,
  storage?: DraftStorage,
): ChatDraft | null {
  try {
    const data = JSON.parse((storage ?? localStorage).getItem(key) ?? "null");
    if (
      !data ||
      typeof data.text !== "string" ||
      data.text.length > 4000 ||
      !Number.isFinite(data.updatedAt) ||
      Date.now() - data.updatedAt > 30 * 86400_000
    )
      return null;
    let editing: DraftEdit | null = null;
    if (
      data.editing &&
      typeof data.editing.messageId === "string" &&
      typeof data.editing.previousRequestId === "string" &&
      typeof data.editing.draft === "string" &&
      data.editing.draft.length <= 4000
    )
      editing = data.editing;
    return { text: data.text, editing };
  } catch {
    return null;
  }
}
export function writeDraft(
  key: string,
  draft: ChatDraft | null,
  storage?: DraftStorage,
) {
  try {
    const target = storage ?? localStorage;
    if (!draft?.text) target.removeItem(key);
    else
      target.setItem(key, JSON.stringify({ ...draft, updatedAt: Date.now() }));
  } catch {
    /* Persistence is optional; the in-memory draft remains usable. */
  }
}
