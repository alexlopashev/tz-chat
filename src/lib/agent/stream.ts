import {
  convertToModelMessages,
  stepCountIs,
  streamText,
  type LanguageModel,
  type ToolSet,
} from "ai";
import type { ChatMessage, MessageStatus } from "../chat-types";
import { researchInstructions } from "./prompt";

export function safeAgentError(error: unknown) {
  const status =
    error && typeof error === "object" && "statusCode" in error
      ? error.statusCode
      : undefined;
  if (status === 401 || status === 403)
    return "The AI service is unavailable for this workspace. Your question is saved; please try again after service access is restored.";
  if (status === 429)
    return "The AI service is busy. Your question is saved; please try again shortly.";
  return "The answer couldn't be completed. Your question is saved. Please try again.";
}
export async function agentResponse(options: {
  model: LanguageModel;
  tools: ToolSet;
  history: ChatMessage[];
  assistantId: string;
  requestId: string;
  signal: AbortSignal;
  finish: (
    parts: ChatMessage["parts"],
    status: Exclude<MessageStatus, "pending">,
  ) => Promise<void>;
  close: () => Promise<void>;
  cancel: () => void;
  now?: Date;
}) {
  let errorMessage: string | undefined;
  const messages = await convertToModelMessages(options.history, {
    tools: options.tools,
    ignoreIncompleteToolCalls: true,
  });
  const result = streamText({
    model: options.model,
    tools: options.tools,
    messages,
    system: researchInstructions(options.now),
    maxOutputTokens: 3000,
    maxRetries: 0,
    stopWhen: stepCountIs(6),
    toolCallConcurrency: 2,
    prepareStep: ({ stepNumber }) =>
      stepNumber >= 5 ? { toolChoice: "none" } : {},
    abortSignal: options.signal,
    onError: ({ error }) => {
      errorMessage = safeAgentError(error);
    },
  });
  return result.toUIMessageStreamResponse<ChatMessage>({
    originalMessages: options.history,
    generateMessageId: () => options.assistantId,
    sendReasoning: false,
    sendSources: true,
    headers: { "Cache-Control": "no-store", "X-Accel-Buffering": "no" },
    onError: () =>
      errorMessage ??
      "The answer couldn't be completed. Your question is saved. Please try again.",
    messageMetadata: ({ part }) =>
      part.type === "start"
        ? { status: "pending", requestId: options.requestId }
        : part.type === "finish"
          ? {
              status:
                errorMessage || part.finishReason !== "stop"
                  ? "failed"
                  : "complete",
              requestId: options.requestId,
            }
          : undefined,
    onEnd: async ({
      responseMessage,
      isAborted,
      isCancelled,
      outcome,
      finishReason,
    }) => {
      const status =
        isAborted || isCancelled || options.signal.aborted
          ? "interrupted"
          : errorMessage ||
              outcome.status !== "completed" ||
              finishReason !== "stop"
            ? "failed"
            : "complete";
      if (isCancelled) options.cancel();
      const parts = [...responseMessage.parts];
      if (status !== "complete")
        parts.push({
          type: "data-error",
          data:
            status === "interrupted"
              ? "Response interrupted. You can retry this question."
              : (errorMessage ??
                "The research limit was reached before the answer was complete. Try a narrower question."),
        });
      try {
        await options.finish(parts, status);
      } finally {
        await options.close();
      }
    },
  });
}
