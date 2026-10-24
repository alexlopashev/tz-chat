import { expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import {
  usageStep,
  usageTotals,
  type Pricing,
  type RunUsage,
} from "../src/lib/usage";
import { cacheSettings, stableObject } from "../src/lib/agent/cache";
import { researchPrompt } from "../src/lib/agent/prompt";
import { UsageRecorder } from "../src/lib/agent/accounting";
import { toChatMessages } from "../src/lib/chat-types";
import { convertToModelMessages, type LanguageModelUsage } from "ai";
import type { Repository } from "../src/lib/repository";
const price: Pricing = {
  input: 0.000002,
  output: 0.00001,
  cacheRead: 0.0000001,
  cacheWrite: 0.0000025,
  fetchedAt: "2026-10-24T00:00:00Z",
};
const usage: LanguageModelUsage = {
  inputTokens: 1000,
  inputTokenDetails: {
    noCacheTokens: 200,
    cacheReadTokens: 700,
    cacheWriteTokens: 100,
  },
  outputTokens: 50,
  outputTokenDetails: { textTokens: 40, reasoningTokens: 10 },
  totalTokens: 1050,
};
const model = "openai/gpt-6.1-sol";
it("uses modern OpenAI controls with stable isolated keys and Gateway affinity", () => {
  const a = cacheSettings("owner-a", "chat-a", model, "chat");
  expect(a).toEqual(cacheSettings("owner-a", "chat-a", model, "chat"));
  for (const b of [
    cacheSettings("owner-b", "chat-a", model, "chat"),
    cacheSettings("owner-a", "chat-b", model, "chat"),
    cacheSettings("owner-a", "chat-a", model, "title"),
  ])
    expect(b.key).not.toBe(a.key);
  expect(a.providerOptions.openai).toMatchObject({
    promptCacheOptions: { mode: "implicit", ttl: "30m" },
    promptCacheKey: a.key,
    store: false,
  });
  expect(a.providerOptions.openai).not.toHaveProperty("promptCacheRetention");
  expect(a.providerOptions.gateway).toMatchObject({
    sessionId: a.key,
    sessionAffinity: true,
  });
  expect(
    cacheSettings("a", "b", "anthropic/claude-sonnet-5", "chat")
      .providerOptions,
  ).not.toHaveProperty("openai");
  expect(
    cacheSettings("a", "b", "openai/gpt-4.1", "chat").providerOptions.openai,
  ).not.toHaveProperty("promptCacheOptions");
});
it("keeps changing dates out of the stable cache prefix and canonicalizes schemas", () => {
  const a = researchPrompt(new Date("2026-10-23T12:00Z"), true),
    b = researchPrompt(new Date("2026-10-24T12:00Z"), true);
  expect(a[0]).toEqual(b[0]);
  expect(a[1].content).not.toEqual(b[1].content);
  expect(a[0].providerOptions).toMatchObject({
    openai: { promptCacheBreakpoint: { mode: "explicit", ttl: "30m" } },
  });
  expect(JSON.stringify(stableObject({ b: { z: 1, a: 2 }, a: [2, 1] }))).toBe(
    JSON.stringify(stableObject({ a: [2, 1], b: { a: 2, z: 1 } })),
  );
});
it("keeps cache reads/writes disjoint and estimates only from complete known rates", () => {
  const step = usageStep(0, model, usage, {}, "stop", price);
  expect(step.costSource).toBe("estimate");
  expect(step.costUsd).toBeCloseTo(
    200 * price.input +
      700 * price.cacheRead! +
      100 * price.cacheWrite! +
      50 * price.output,
    12,
  );
  expect(step.output).toBe(50);
  expect(step.reasoning).toBe(10);
  expect(
    usageStep(0, model, usage, {}, "stop", { ...price, cacheWrite: null })
      .costUsd,
  ).toBeNull();
  expect(
    usageStep(
      0,
      model,
      {
        ...usage,
        inputTokenDetails: {
          ...usage.inputTokenDetails,
          cacheReadTokens: undefined,
        },
      },
      {},
      "stop",
      price,
    ).cacheRead,
  ).toBeNull();
  expect(
    usageStep(0, model, { ...usage, inputTokens: 1 }, {}, "stop", price)
      .costUsd,
  ).toBeNull();
});
it("prefers Gateway-reported cost, including zero, and never exposes arbitrary provider metadata", () => {
  const step = usageStep(
    0,
    model,
    usage,
    {
      gateway: {
        cost: "0",
        generationId: "gen_test",
        routing: { finalProvider: "openai", canonicalSlug: model },
        secret: "do-not-persist",
      },
      openai: { secret: "hidden" },
    },
    "stop",
    price,
  );
  expect(step.costUsd).toBe(0);
  expect(step.costSource).toBe("gateway");
  expect(JSON.stringify(step)).not.toContain("secret");
  expect(
    usageStep(
      0,
      model,
      usage,
      { gateway: { routing: { canonicalSlug: "other/model" } } },
      "stop",
      price,
    ).costUsd,
  ).toBeNull();
});
it("records every model step once, preserves attempt totals, and keeps telemetry out of LLM history", async () => {
  const startUsage = vi.fn(),
    saveUsage = vi.fn();
  const tracker = new UsageRecorder(
    { startUsage, saveUsage } as unknown as Repository,
    "owner",
    "chat",
    model,
    "chat",
    price,
    "run-a",
  );
  await tracker.start();
  await tracker.startStep(0);
  const event = {
    stepNumber: 0,
    usage,
    providerMetadata: { gateway: { cost: "0.1" } },
    finishReason: "tool-calls",
    toolCalls: [{}],
  };
  await tracker.step(event);
  await tracker.step(event);
  await tracker.startStep(1);
  await tracker.step({
    ...event,
    stepNumber: 1,
    finishReason: "stop",
    toolCalls: [],
  });
  const snapshot = await tracker.finish("complete");
  expect(snapshot.steps).toHaveLength(2);
  expect(snapshot.toolCalls).toBe(1);
  const old = { ...snapshot, id: "old-run", status: "interrupted" as const };
  const title = { ...snapshot, id: "title-run", kind: "title" as const };
  const total = usageTotals([old, snapshot, title, snapshot]);
  expect(total.runs).toBe(3);
  expect(total.costUsd.value).toBeCloseTo(0.6);
  expect(total.incomplete).toBe(true);
  const messages = toChatMessages([
    {
      id: "assistant",
      role: "assistant",
      request_id: "request",
      status: "complete",
      parts_json: [
        { type: "text", text: "Answer" },
        { type: "data-usage", data: snapshot },
      ],
    },
  ]);
  expect(messages[0].metadata?.usage?.id).toBe("run-a");
  expect(JSON.stringify(await convertToModelMessages(messages))).not.toContain(
    "run-a",
  );
});
it("does not turn missing or aborted usage into free requests", () => {
  const step = usageStep(
    0,
    model,
    {
      ...usage,
      inputTokens: undefined,
      outputTokens: undefined,
      inputTokenDetails: {
        noCacheTokens: undefined,
        cacheReadTokens: undefined,
        cacheWriteTokens: undefined,
      },
    },
    {},
    "error",
    null,
  );
  const run = {
    id: "a",
    status: "interrupted",
    steps: [step],
    startedSteps: 2,
  } as RunUsage;
  const total = usageTotals([run]);
  expect(total.costUsd.value).toBeNull();
  expect(total.costUsd.missing).toBe(1);
  expect(total.input.value).toBeNull();
  expect(total.incomplete).toBe(true);
});
