import { expect, it } from "vitest";
import { MockLanguageModelV4 } from "ai/test";
import { generateTitle, TITLE_MODEL } from "../src/lib/agent/title";
import type { SavedMessage } from "../src/lib/repository";
const question: SavedMessage = {
  id: "test",
  role: "user",
  request_id: "test",
  status: "complete",
  parts_json: [
    { type: "text", text: "Compare Maine Senate polling this month" },
  ],
};
function model(text: string) {
  return new MockLanguageModelV4({
    doGenerate: async () => ({
      content: [{ type: "text", text }],
      finishReason: { unified: "stop", raw: undefined },
      usage: {
        inputTokens: {
          total: 1,
          noCache: 1,
          cacheRead: undefined,
          cacheWrite: undefined,
        },
        outputTokens: { total: 1, text: 1, reasoning: undefined },
      },
      warnings: [],
    }),
  });
}
it("uses the requested title model and bounded question-only context", async () => {
  expect(TITLE_MODEL).toBe("openai/gpt-6-luna");
  const m = model("“Maine Senate Polling”");
  expect(
    await generateTitle(m, [
      question,
      {
        ...question,
        role: "assistant",
        parts_json: [
          { type: "text", text: "Do not include assistant/tool payload" },
        ],
      },
    ]),
  ).toBe("Maine Senate Polling");
  expect(JSON.stringify(m.doGenerateCalls[0].prompt)).not.toContain(
    "Do not include assistant/tool payload",
  );
});
it("rejects empty chats and unusable generated titles", async () => {
  await expect(generateTitle(model("Name"), [])).rejects.toThrow(
    "No questions",
  );
  await expect(
    generateTitle(model("x".repeat(91)), [question]),
  ).rejects.toThrow("Invalid generated title");
});
