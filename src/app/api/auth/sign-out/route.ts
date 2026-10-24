import { cookies } from "next/headers";
import { authSettings, currentSessionId, repository } from "@/lib/auth/session";
import { sessionHash } from "@/lib/auth/crypto";
import { assertSameOrigin, failure, json } from "@/lib/http";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const id = await currentSessionId();
    if (id) await repository().revokeSession(sessionHash(id));
    const settings = authSettings();
    (await cookies()).set(settings.cookieName, "", {
      ...settings.options,
      maxAge: 0,
    });
    return json({ ok: true });
  } catch (error) {
    return failure(error);
  }
}
