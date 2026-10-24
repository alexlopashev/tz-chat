import { after } from "next/server";
import { TITLE_MODEL, updateGeneratedTitle } from "@/lib/agent/title";
import { z } from "zod";
import { currentRcpToken, repository } from "@/lib/auth/session";
import {
  assertSameOrigin,
  failure,
  HttpError,
  readJson,
  requireSession,
} from "@/lib/http";
import { chatModel } from "@/lib/gateway";
import { connectPollingMcp, McpAccessError } from "@/lib/mcp";
import { pollingTools } from "@/lib/agent/tools";
import { agentResponse } from "@/lib/agent/stream";
import { toChatMessages } from "@/lib/chat-types";

export const maxDuration = 120;
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  let repo: ReturnType<typeof repository> | undefined;
  let reserved:
    | {
        userId: string;
        conversationId: string;
        assistantId: string;
        generationId: string;
      }
    | undefined;
  let client: Awaited<ReturnType<typeof connectPollingMcp>> | undefined;
  let streamOwnsClient = false;
  const controller = new AbortController();
  const signal = AbortSignal.any([
    request.signal,
    controller.signal,
    AbortSignal.timeout(90_000),
  ]);
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
        edit: z
          .object({
            messageId: z.string().uuid(),
            previousRequestId: z.string().uuid(),
          })
          .optional(),
      }),
    );
    const token = await currentRcpToken();
    if (!token)
      throw new HttpError(
        401,
        "Your session has ended. Sign in again to continue.",
      );
    const model = chatModel();
    repo = repository();
    const activeRepo = repo;
    const turn = await repo.reserveTurn(
      session.user_id,
      id,
      body.text,
      body.requestId,
      body.edit,
    );
    if (turn.kind === "not-found")
      throw new HttpError(404, "Conversation not found.");
    if (turn.kind === "complete")
      throw new HttpError(
        409,
        "This question already has an answer. Reload the conversation to see it.",
      );
    if (turn.kind === "conflict")
      throw new HttpError(
        409,
        "This request ID belongs to a different question. Send it as a new message.",
      );
    if (turn.kind !== "reserved")
      throw new HttpError(
        409,
        "Another answer is in progress, or a newer question has been sent. Reload and try again shortly.",
      );
    reserved = {
      userId: session.user_id,
      conversationId: id,
      assistantId: turn.assistantId,
      generationId: turn.generationId,
    };
    const saved = await repo.conversation(session.user_id, id);
    if (!saved) throw new HttpError(404, "Conversation not found.");
    const history = toChatMessages(
      saved.messages.filter(
        (message) => message.role === "user" || message.status === "complete",
      ),
    );
    if (JSON.stringify(history).length > 350_000)
      throw new HttpError(
        422,
        "This conversation has reached its research context limit. Start a new chat to continue.",
      );
    if (saved.title_source === "fallback")
      after(async () => {
        try {
          await updateGeneratedTitle(
            activeRepo,
            session.user_id,
            id,
            chatModel(TITLE_MODEL),
            true,
          );
        } catch {
          console.error(
            JSON.stringify({
              event: "automatic_title_failed",
              conversationId: id,
            }),
          );
        }
      });
    client = await connectPollingMcp(token, signal);
    const tools = await pollingTools(client, signal);
    const activeClient = client;
    const response = await agentResponse({
      model,
      tools,
      history,
      assistantId: turn.assistantId,
      requestId: body.requestId,
      signal,
      finish: async (parts, status) => {
        const stored = await activeRepo.finishTurn(
          session.user_id,
          id,
          turn.assistantId,
          turn.generationId,
          parts,
          status,
        );
        if (!stored) throw new Error("Generation was superseded.");
      },
      close: () => activeClient.close().catch(() => {}),
      cancel: () => controller.abort(),
    });
    streamOwnsClient = true;
    return response;
  } catch (error) {
    const message =
      error instanceof HttpError
        ? error.message
        : error instanceof McpAccessError && error.rejected
          ? "RCP access has expired. Sign out and reconnect with a current token."
          : reserved
            ? "The research service couldn't start. Your question is saved; please try again shortly."
            : "The research service isn't available. Please try again shortly.";
    if (reserved && repo) {
      try {
        await repo.finishTurn(
          reserved.userId,
          reserved.conversationId,
          reserved.assistantId,
          reserved.generationId,
          [{ type: "data-error", data: message }],
          signal.aborted ? "interrupted" : "failed",
        );
      } catch {
        console.error(
          JSON.stringify({
            event: "turn_finalization_failed",
            conversationId: reserved.conversationId,
          }),
        );
      }
    }
    return error instanceof HttpError
      ? failure(error)
      : failure(new HttpError(503, message));
  } finally {
    if (!streamOwnsClient) {
      controller.abort();
      await client?.close().catch(() => {});
    }
  }
}
