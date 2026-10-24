import { createHash } from "node:crypto";
import type { ProviderOptions } from "@ai-sdk/provider-utils";
export const PROMPT_VERSION = "rcp-research-v3";
export function cacheSettings(
  owner: string,
  conversation: string,
  model: string,
  kind: "chat" | "title",
) {
  const key = createHash("sha256")
    .update(JSON.stringify([PROMPT_VERSION, owner, conversation, model, kind]))
    .digest("hex");
  const modernOpenAI =
    /^openai\/gpt-(?:[6-9](?:[.-]|$)|5\.(?:[6-9]|[1-9]\d))/.test(model);
  const openAI = model.startsWith("openai/");
  const providerOptions: ProviderOptions = {
    gateway: { sessionId: key, sessionAffinity: true, caching: "auto" },
    ...(openAI
      ? {
          openai: {
            promptCacheKey: key,
            store: false,
            ...(modernOpenAI
              ? { promptCacheOptions: { mode: "implicit", ttl: "30m" } }
              : {}),
          },
        }
      : {}),
  };
  return {
    key,
    modernOpenAI,
    policy: modernOpenAI
      ? "OpenAI implicit · 30m"
      : openAI
        ? "OpenAI provider default"
        : "Gateway automatic",
    providerOptions,
  };
}
/** Preserve array semantics while making schema object serialization deterministic. */
export function stableObject<T>(value: T): T {
  if (Array.isArray(value)) return value.map(stableObject) as T;
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, child]) => [key, stableObject(child)]),
    ) as T;
  return value;
}
