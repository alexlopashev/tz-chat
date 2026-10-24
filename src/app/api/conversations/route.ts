import { repository } from "@/lib/auth/session";
import { assertSameOrigin, failure, json, requireSession } from "@/lib/http";
export async function GET() {
  try {
    const session = await requireSession();
    return json({
      conversations: await repository().conversations(session.user_id),
    });
  } catch (error) {
    return failure(error);
  }
}
export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const session = await requireSession();
    return json(
      { id: await repository().createConversation(session.user_id) },
      201,
    );
  } catch (error) {
    return failure(error);
  }
}
