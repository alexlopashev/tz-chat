import type { LanguageModelUsage } from "ai";
export type Pricing = {
  input: number;
  output: number;
  cacheRead: number | null;
  cacheWrite: number | null;
  fetchedAt: string;
};
export type UsageStep = {
  index: number;
  model: string;
  provider: string | null;
  finishReason: string;
  input: number | null;
  uncached: number | null;
  cacheRead: number | null;
  cacheWrite: number | null;
  output: number | null;
  reasoning: number | null;
  costUsd: number | null;
  costSource: "gateway" | "estimate" | "unavailable";
  rates: Pricing | null;
  gatewayGenerationId: string | null;
};
export type RunUsage = {
  version: 1;
  id: string;
  kind: "chat" | "title";
  model: string;
  status: "pending" | "complete" | "failed" | "interrupted";
  startedAt: string;
  elapsedMs: number;
  startedSteps: number;
  toolCalls: number;
  cachePolicy: string;
  cacheKey: string;
  steps: UsageStep[];
  persistenceWarning?: boolean;
};
function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : {};
}
function count(value: unknown): number | null {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0
    ? value
    : null;
}
export function money(value: unknown): number | null {
  if (
    typeof value !== "number" &&
    (typeof value !== "string" || !/^\d+(?:\.\d+)?(?:e-?\d+)?$/i.test(value))
  )
    return null;
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : null;
}
export function usageStep(
  index: number,
  model: string,
  usage: LanguageModelUsage,
  metadata: unknown,
  finishReason: string,
  pricing: Pricing | null,
): UsageStep {
  const gateway = record(record(metadata).gateway),
    routing = record(gateway.routing);
  const actualModel =
    typeof routing.canonicalSlug === "string" ? routing.canonicalSlug : model;
  const rates = actualModel === model ? pricing : null;
  const input = count(usage.inputTokens),
    cacheRead = count(usage.inputTokenDetails?.cacheReadTokens),
    cacheWrite = count(usage.inputTokenDetails?.cacheWriteTokens),
    output = count(usage.outputTokens);
  let uncached = count(usage.inputTokenDetails?.noCacheTokens);
  if (
    uncached === null &&
    input !== null &&
    cacheRead !== null &&
    cacheWrite !== null
  )
    uncached = count(input - cacheRead - cacheWrite);
  let costUsd = money(gateway.cost),
    costSource: UsageStep["costSource"] =
      costUsd === null ? "unavailable" : "gateway";
  if (
    costUsd === null &&
    rates &&
    input !== null &&
    uncached !== null &&
    cacheRead !== null &&
    cacheWrite !== null &&
    output !== null &&
    input === uncached + cacheRead + cacheWrite &&
    (cacheRead === 0 || rates.cacheRead !== null) &&
    (cacheWrite === 0 || rates.cacheWrite !== null)
  ) {
    costUsd =
      uncached * rates.input +
      cacheRead * (rates.cacheRead ?? 0) +
      cacheWrite * (rates.cacheWrite ?? 0) +
      output * rates.output;
    costSource = "estimate";
  }
  return {
    index,
    model: actualModel,
    provider:
      typeof routing.finalProvider === "string" ? routing.finalProvider : null,
    finishReason,
    input,
    uncached,
    cacheRead,
    cacheWrite,
    output,
    reasoning: count(usage.outputTokenDetails?.reasoningTokens),
    costUsd,
    costSource,
    rates,
    gatewayGenerationId:
      typeof gateway.generationId === "string" ? gateway.generationId : null,
  };
}
export function usageTotals(runs: RunUsage[]) {
  const unique = [...new Map(runs.map((run) => [run.id, run])).values()];
  const steps = unique.flatMap((run) => run.steps);
  const sum = (
    key:
      "input" | "uncached" | "cacheRead" | "cacheWrite" | "output" | "costUsd",
  ) => {
    const values = steps
      .map((step) => step[key])
      .filter((n): n is number => n !== null);
    return {
      value: values.length ? values.reduce((a, b) => a + b, 0) : null,
      missing: steps.length - values.length,
    };
  };
  return {
    runs: unique.length,
    steps: steps.length,
    input: sum("input"),
    uncached: sum("uncached"),
    cacheRead: sum("cacheRead"),
    cacheWrite: sum("cacheWrite"),
    output: sum("output"),
    costUsd: sum("costUsd"),
    estimated: steps.some((s) => s.costSource === "estimate"),
    incomplete: unique.some(
      (r) =>
        r.status !== "complete" ||
        r.startedSteps > r.steps.length ||
        r.persistenceWarning,
    ),
  };
}
