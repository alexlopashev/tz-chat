import { z } from "zod";
import { repository } from "@/lib/auth/session";
import { failure, HttpError, json, requireSession } from "@/lib/http";
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
