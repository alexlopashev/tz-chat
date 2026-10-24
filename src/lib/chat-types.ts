import type { RunUsage } from "./usage";
import type { UIMessage } from "ai";
export type MessageStatus = "pending" | "complete" | "failed" | "interrupted";
export type ChatMessage = UIMessage<{
  status: MessageStatus;
  requestId: string;
  usage?: RunUsage;
}>;
export interface StoredMessage {
  id: string;
  role: "user" | "assistant" | "system";
  request_id: string;
  parts_json: UIMessage["parts"];
  status: MessageStatus;
}
export function toChatMessages(messages: StoredMessage[]): ChatMessage[] {
  return messages.map((message) => ({
    id: message.id,
    role: message.role,
    parts: message.parts_json,
    metadata: {
      status: message.status,
      requestId: message.request_id,
      usage: message.parts_json
        .flatMap((part) =>
          part.type === "data-usage" && "data" in part
            ? [part.data as RunUsage]
            : [],
        )
        .at(-1),
    },
  }));
}
