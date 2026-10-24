import { startUsage, type UsageRecorder } from "@/lib/agent/accounting";
import { database } from "@/lib/database";
import {
  SharedProtection,
  ProtectionError,
  dependencyOutcome,
  type Outcome,
} from "@/lib/protection";
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
  let accounting: UsageRecorder | undefined;

  let release: (() => Promise<void>) | undefined;
  let finishGateway: ((outcome: Outcome) => Promise<void>) | undefined;
  const controller = new AbortController();
  const signal = AbortSignal.any([
    request.signal,
    controller.signal,
    AbortSignal.timeout(90_000),
  ]);
  try {
    assertSameOrigin(request);
    const protection = new SharedProtection(database());
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
    if (!(await repo.ownsConversation(session.user_id, id)))
      throw new HttpError(404, "Conversation not found.");
    release = await protection.admit(session.user_id, "chat");
    finishGateway = await protection.circuit("gateway");
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
    accounting = await startUsage(
      repo,
      session.user_id,
      id,
      model.modelId,
      "chat",
      turn.generationId,
    );
    const saved = await repo.conversation(session.user_id, id);
    if (!saved) throw new HttpError(404, "Conversation not found.");
    const history = toChatMessages(
      saved.messages.filter(
        (message) => message.role === "user" || message.status === "complete",
      ),
    );
    // Technical usage parts never enter the model prompt or its context budget.
    const contextSize = JSON.stringify(
      history.map(({ role, parts }) => ({
        role,
        parts: parts.filter((part) => part.type !== "data-usage"),
      })),
    ).length;
    if (contextSize > 350_000)
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
    client = await connectPollingMcp(token, signal, protection);
    const tools = await pollingTools(client, signal);
    const activeClient = client;
    const response = await agentResponse({
      model,
      tools,
      accounting,
      report: async (error) => {
        await finishGateway?.(
          error ? dependencyOutcome(error, signal) : "success",
        );
      },
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
      close: async () => {
        await activeClient.close().catch(() => {});
        await finishGateway?.(
          signal.aborted ? dependencyOutcome(signal.reason, signal) : "neutral",
        );
        await release?.();
      },
      cancel: () => controller.abort(),
    });
    streamOwnsClient = true;
    return response;
  } catch (error) {
    const message =
      error instanceof HttpError || error instanceof ProtectionError
        ? error.message
        : error instanceof McpAccessError && error.rejected
          ? "RCP access has expired. Sign out and reconnect with a current token."
          : reserved
            ? "The research service couldn't start. Your question is saved; please try again shortly."
            : "The research service isn't available. Please try again shortly.";
    if (reserved && repo) {
      try {
        const usage = await accounting?.finish(
          signal.aborted ? "interrupted" : "failed",
        );
        await repo.finishTurn(
          reserved.userId,
          reserved.conversationId,
          reserved.assistantId,
          reserved.generationId,
          [
            { type: "data-error", data: message },
            ...(usage ? [{ type: "data-usage" as const, data: usage }] : []),
          ],
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
    if (error instanceof ProtectionError) {
      const response = failure(error);
      if (!reserved) return response;
      return Response.json(
        {
          error: message + " Your question is saved; retry it later.",
          code: error.code,
          retryAfter: error.retryAfter,
          saved: true,
        },
        { status: error.status, headers: response.headers },
      );
    }
    const response =
      error instanceof HttpError
        ? failure(error)
        : failure(new HttpError(503, message));
    return Response.json(
      { error: message, saved: Boolean(reserved) },
      { status: response.status, headers: response.headers },
    );
  } finally {
    if (!streamOwnsClient) {
      controller.abort();
      await client?.close().catch(() => {});
      await finishGateway?.("neutral");
      await release?.();
    }
  }
}
