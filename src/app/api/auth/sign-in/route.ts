import { cookies } from "next/headers";
import { z } from "zod";
import { mcpConfig } from "@/lib/config";
import { connectPollingMcp, McpAccessError } from "@/lib/mcp";
import { parseIdentity } from "@/lib/auth/identity";
import {
  encryptionKey,
  encryptToken,
  newSessionId,
  sessionHash,
  SESSION_SECONDS,
} from "@/lib/auth/crypto";
import { authSettings, currentSessionId, repository } from "@/lib/auth/session";
import {
  assertSameOrigin,
  failure,
  HttpError,
  json,
  readJson,
} from "@/lib/http";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const key = encryptionKey();
    const { token: input } = await readJson(
      request,
      z.object({ token: z.string().min(1).max(8192) }),
    );
    let token: string;
    try {
      token = mcpConfig({
        url: "https://rcp.tazalabs.ai/mcp",
        token: input,
      }).token;
    } catch {
      throw new HttpError(
        400,
        "Paste your full RCP MCP token. A Bearer prefix is optional.",
      );
    }
    let client;
    let userId: string;
    try {
      client = await connectPollingMcp(token);
      const result = await client.callTool({
        name: "whoami",
        arguments: {
          purpose_kind: "other",
          purpose:
            "Verify the account signing into the polling research application.",
        },
        options: { timeout: 10_000 },
      });
      userId = parseIdentity(result).userId;
    } catch (error) {
      if (error instanceof McpAccessError && error.rejected)
        throw new HttpError(
          401,
          "RCP didn't accept this token. Copy a current token from the RCP connection page and try again.",
        );
      throw new HttpError(
        502,
        "We couldn't verify your RCP account. Please try again shortly.",
      );
    } finally {
      await client?.close().catch(() => {});
    }
    const id = newSessionId();
    const previous = await currentSessionId();
    await repository().createSession(
      userId,
      sessionHash(id),
      encryptToken(token, userId, key),
      new Date(Date.now() + SESSION_SECONDS * 1000),
      previous ? sessionHash(previous) : undefined,
    );
    const settings = authSettings();
    (await cookies()).set(settings.cookieName, id, settings.options);
    return json({ ok: true });
  } catch (error) {
    return failure(error);
  }
}
