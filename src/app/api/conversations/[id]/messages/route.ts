import { z } from "zod";
import { repository } from "@/lib/auth/session";
import {
  assertSameOrigin,
  failure,
  HttpError,
  json,
  readJson,
  requireSession,
} from "@/lib/http";
export async function POST(
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
      z.object({
        text: z.string().trim().min(1).max(4000),
        requestId: z.string().uuid(),
      }),
    );
    if (
      !(await repository().saveQuestion(
        session.user_id,
        id,
        body.text,
        body.requestId,
      ))
    )
      throw new HttpError(404, "Conversation not found.");
    return json({ ok: true });
  } catch (error) {
    return failure(error);
  }
}
