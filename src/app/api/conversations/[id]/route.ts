import { chatModel } from "@/lib/gateway";
import { TITLE_MODEL, updateGeneratedTitle } from "@/lib/agent/title";
import { z } from "zod";
import { repository } from "@/lib/auth/session";
import {
  assertSameOrigin,
  readJson,
  failure,
  HttpError,
  json,
  requireSession,
} from "@/lib/http";
export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const session = await requireSession();
    const { id } = await context.params;
    if (!z.string().uuid().safeParse(id).success)
      throw new HttpError(404, "Conversation not found.");
    const conversation = await repository().conversation(session.user_id, id);
    if (!conversation) throw new HttpError(404, "Conversation not found.");
    return json({ conversation });
  } catch (error) {
    return failure(error);
  }
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    assertSameOrigin(request);
    const session = await requireSession();
    const { id } = await context.params;
    if (!z.string().uuid().safeParse(id).success)
      throw new HttpError(404, "Conversation not found.");
    const body = await readJson(
      request,
      z.discriminatedUnion("action", [
        z.object({ action: z.literal("pin"), pinned: z.boolean() }),
        z.object({
          action: z.literal("rename"),
          title: z.string().trim().min(1).max(90),
        }),
        z.object({ action: z.literal("regenerate-title") }),
      ]),
    );
    const repo = repository();
    let updated: boolean;
    if (body.action === "pin")
      updated = await repo.pinConversation(session.user_id, id, body.pinned);
    else if (body.action === "rename")
      updated = await repo.renameConversation(session.user_id, id, body.title);
    else {
      const conversation = await repo.conversation(session.user_id, id);
      if (!conversation) throw new HttpError(404, "Conversation not found.");
      if (!conversation.messages.some((message) => message.role === "user"))
        throw new HttpError(400, "Send a question before generating a title.");
      try {
        updated = await updateGeneratedTitle(
          repo,
          session.user_id,
          id,
          chatModel(TITLE_MODEL),
        );
      } catch {
        throw new HttpError(
          503,
          "Couldn't generate a title. Your current title is unchanged; please try again.",
        );
      }
      if (!updated)
        throw new HttpError(
          409,
          "The title changed while generating. Reload to see the latest title.",
        );
    }
    if (!updated) throw new HttpError(404, "Conversation not found.");
    return json({ ok: true });
  } catch (error) {
    return failure(error);
  }
}
