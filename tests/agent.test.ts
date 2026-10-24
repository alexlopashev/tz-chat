import { describe, expect, it, vi } from "vitest";
import { convertToModelMessages } from "ai";
import { MockLanguageModelV4 } from "ai/test";
import type { MCPClient } from "@ai-sdk/mcp";
import { agentResponse } from "../src/lib/agent/stream";
import { pollingTools } from "../src/lib/agent/tools";
import {
  historyChanges,
  historySeries,
  normalizeEvidence,
} from "../src/lib/agent/evidence";
import { researchDates } from "../src/lib/agent/prompt";
import type { ChatMessage } from "../src/lib/chat-types";

type ModelResult = Awaited<ReturnType<MockLanguageModelV4["doStream"]>>;
type ModelChunk =
  ModelResult["stream"] extends ReadableStream<infer T> ? T : never;
function stream(chunks: ModelChunk[]): ModelResult {
  return {
    stream: new ReadableStream({
      start(controller) {
        chunks.forEach((chunk) => controller.enqueue(chunk));
        controller.close();
      },
    }),
  };
}
function finish(reason: "stop" | "tool-calls" = "stop"): ModelChunk {
  return {
    type: "finish",
    finishReason: { unified: reason, raw: undefined },
    usage: {
      inputTokens: {
        total: 1,
        noCache: 1,
        cacheRead: undefined,
        cacheWrite: undefined,
      },
      outputTokens: { total: 1, text: 1, reasoning: undefined },
    },
  };
}
function textStream(text: string) {
  return stream([
    { type: "text-start", id: "text" },
    { type: "text-delta", id: "text", delta: text },
    { type: "text-end", id: "text" },
    finish(),
  ]);
}
const synthetic = {
  title: "Synthetic fixture race",
  current_average: {
    results: [
      { name: "Synthetic A", value: 51 },
      { name: "Synthetic B", value: null },
    ],
    as_of: "2026-10-24",
    date_label: "10/01 - 10/24",
  },
  source: { rcp_url: "https://example.com/synthetic-fixture" },
};
function fakeClient() {
  const definition = {
    name: "get_race",
    description: "Synthetic test lookup",
    inputSchema: {
      type: "object",
      properties: { race_id: { type: "integer" }, purpose: { type: "string" } },
      required: ["race_id", "purpose"],
    },
  };
  return {
    listTools: vi.fn().mockResolvedValue({
      tools: [
        definition,
        { ...definition, name: "whoami" },
        { ...definition, name: "send_feedback" },
      ],
    }),
    callTool: vi.fn().mockResolvedValue({
      content: [{ type: "text", text: JSON.stringify(synthetic) }],
      isError: false,
    }),
  };
}
function user(text = "Synthetic test question"): ChatMessage {
  return {
    id: "user",
    role: "user",
    parts: [{ type: "text", text }],
    metadata: { status: "complete", requestId: "request" },
  };
}

describe("Bounded polling agent (deterministic model, not live generation)", () => {
  it("executes only read tools, streams evidence, and replays tool history on a follow-up", async () => {
    const client = fakeClient(),
      signal = new AbortController().signal;
    const tools = await pollingTools(client as unknown as MCPClient, signal);
    expect(Object.keys(tools)).toEqual(["get_race"]);
    const model = new MockLanguageModelV4({
      doStream: [
        stream([
          { type: "text-start", id: "intro" },
          { type: "text-delta", id: "intro", delta: "Checking the evidence." },
          { type: "text-end", id: "intro" },
          {
            type: "tool-call",
            toolCallId: "lookup-1",
            toolName: "get_race",
            input: JSON.stringify({ race_id: 1 }),
          },
          finish("tool-calls"),
        ]),
        textStream(
          "Synthetic fixture: A has 51% support; B is missing. [Source](https://example.com/synthetic-fixture)",
        ),
      ],
    });
    const persist = vi.fn().mockResolvedValue(undefined),
      close = vi.fn().mockResolvedValue(undefined);
    const response = await agentResponse({
      model,
      tools,
      history: [user()],
      assistantId: "assistant",
      requestId: "request",
      signal,
      finish: persist,
      close,
      cancel: vi.fn(),
    });
    const wire = await response.text();
    expect(wire).toContain("text-delta");
    expect(wire).toContain("tool-output-available");
    expect(model.doStreamCalls).toHaveLength(2);
    expect(client.callTool).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "get_race",
        arguments: expect.objectContaining({
          race_id: 1,
          purpose_kind: "research",
        }),
      }),
    );
    expect(persist).toHaveBeenCalledOnce();
    expect(persist.mock.calls[0][1]).toBe("complete");
    expect(close).toHaveBeenCalledOnce();
    const parts = persist.mock.calls[0][0] as ChatMessage["parts"];
    const reloaded: ChatMessage = {
      id: "assistant",
      role: "assistant",
      parts,
      metadata: { status: "complete", requestId: "request" },
    };
    const history = [
      user(),
      JSON.parse(JSON.stringify(reloaded)) as ChatMessage,
      user("Summarize that evidence."),
    ];
    const converted = await convertToModelMessages(history, { tools });
    expect(JSON.stringify(converted)).toContain("lookup-1");
    expect(converted.some((message) => message.role === "tool")).toBe(true);
    const followup = new MockLanguageModelV4({
      doStream: textStream("Summary of the saved synthetic evidence."),
    });
    const second = await agentResponse({
      model: followup,
      tools,
      history,
      assistantId: "second",
      requestId: "second-request",
      signal,
      finish: vi.fn().mockResolvedValue(undefined),
      close: vi.fn().mockResolvedValue(undefined),
      cancel: vi.fn(),
    });
    await second.text();
    expect(client.callTool).toHaveBeenCalledOnce();
    expect(JSON.stringify(followup.doStreamCalls[0].prompt)).toContain(
      "Synthetic A",
    );
  });
  it("marks provider failure and persists a safe error instead of a completed answer", async () => {
    const persist = vi.fn().mockResolvedValue(undefined),
      close = vi.fn().mockResolvedValue(undefined);
    const model = new MockLanguageModelV4({
      doStream: async () => {
        throw Object.assign(new Error("secret-token raw provider error"), {
          statusCode: 403,
        });
      },
    });
    const response = await agentResponse({
      model,
      tools: {},
      history: [user()],
      assistantId: "failed",
      requestId: "request",
      signal: new AbortController().signal,
      finish: persist,
      close,
      cancel: vi.fn(),
    });
    const wire = await response.text();
    expect(wire).not.toContain("secret-token");
    expect(wire).toContain("AI service is unavailable");
    expect(persist.mock.calls[0][1]).toBe("failed");
    expect(close).toHaveBeenCalledOnce();
  });
  it("persists interrupted state and closes MCP when the reader cancels", async () => {
    const controller = new AbortController();
    const persist = vi.fn().mockResolvedValue(undefined);
    const close = vi.fn().mockResolvedValue(undefined);
    const model = new MockLanguageModelV4({
      doStream: async () => ({
        stream: new ReadableStream<ModelChunk>({
          start(stream) {
            stream.enqueue({ type: "text-start", id: "text" });
            stream.enqueue({
              type: "text-delta",
              id: "text",
              delta: "Partial",
            });
            controller.signal.addEventListener("abort", () => stream.close(), {
              once: true,
            });
          },
        }),
      }),
    });
    const response = await agentResponse({
      model,
      tools: {},
      history: [user()],
      assistantId: "cancelled",
      requestId: "request",
      signal: controller.signal,
      finish: persist,
      close,
      cancel: () => controller.abort(),
    });
    const reader = response.body!.getReader();
    await reader.read();
    await reader.cancel();
    await vi.waitFor(() => expect(persist).toHaveBeenCalledOnce());
    expect(persist.mock.calls[0][1]).toBe("interrupted");
    expect(controller.signal.aborted).toBe(true);
    expect(close).toHaveBeenCalledOnce();
  });
  it("keeps nulls and calculates changes only between actual observation endpoints", () => {
    const data = {
      columns: ["date", "results", "spread"],
      rows: [
        [
          "2026-10-11",
          [
            ["Synthetic A", "Other", 48.5],
            ["Synthetic B", "Other", null],
          ],
          null,
        ],
        [
          "2026-10-22",
          [
            ["Synthetic A", "Other", 48.8],
            ["Synthetic B", "Other", 47.4],
          ],
          1.4,
        ],
      ],
    };
    const result = historyChanges(data);
    expect(result).toMatchObject({
      from: "2026-10-11",
      to: "2026-10-22",
      changes: [
        { name: "Synthetic A", changePp: 0.3 },
        { name: "Synthetic B", changePp: null },
      ],
    });
    const evidence = normalizeEvidence(
      "get_race_average_history",
      { from: "2026-10-10", to: "2026-10-24" },
      {
        content: [
          {
            type: "text",
            text: JSON.stringify({ ...data, call_id: "diagnostic" }),
          },
        ],
      },
      new Date("2026-10-24T12:00:00Z"),
    );
    expect(evidence.data).not.toHaveProperty("call_id");
    expect(evidence.calculations).toEqual(result);
    expect(evidence.requested.to).toBe("2026-10-24");
  });
  it("rejects upstream errors and oversized payloads without exposing raw content", () => {
    expect(() =>
      normalizeEvidence(
        "get_race",
        {},
        { isError: true, content: [{ type: "text", text: "secret" }] },
      ),
    ).toThrow("could not complete");
    expect(() =>
      normalizeEvidence(
        "get_race",
        {},
        { content: [{ type: "text", text: "x".repeat(120001) }] },
      ),
    ).toThrow("too much");
  });
  it("charts only chronological real observations and preserves missing-value gaps", () => {
    const data = {
      columns: ["date", "results", "spread"],
      rows: [
        ["2026-10-20", [["A", "Other", 49]], null],
        ["2026-10-01", [["A", "Other", 45]], null],
        ["2026-10-10", [["A", "Other", null]], null],
      ],
    };
    expect(historySeries(data)?.[0].points).toEqual([
      { date: "2026-10-01", value: 45 },
      { date: "2026-10-10", value: null },
      { date: "2026-10-20", value: 49 },
    ]);
    expect(historySeries({ ...data, rows: data.rows.slice(0, 1) })).toBeNull();
    expect(
      historySeries({ ...data, rows: [data.rows[0], data.rows[0]] }),
    ).toBeNull();
    expect(
      historySeries({
        ...data,
        rows: [["2026-02-30", [["A", "Other", 45]], null], data.rows[0]],
      }),
    ).toBeNull();
    expect(
      historySeries({
        ...data,
        rows: [["2026-10-01", [["A", "Other", 105]], null], data.rows[0]],
      }),
    ).toBeNull();
  });
  it("resolves month boundaries with calendar clamping in the documented timezone", () => {
    expect(researchDates(new Date("2024-03-31T12:00:00Z"))).toMatchObject({
      today: "2024-03-31",
      lastMonth: "2024-02-29",
    });
    expect(researchDates(new Date("2026-10-24T01:00:00Z")).today).toBe(
      "2026-10-23",
    );
  });
});
