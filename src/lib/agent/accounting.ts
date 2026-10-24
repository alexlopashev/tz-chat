import { randomUUID } from "node:crypto";
import type { LanguageModelUsage } from "ai";
import type { Repository } from "../repository";
import { modelPricing } from "../gateway";
import { usageStep, type RunUsage, type Pricing } from "../usage";
import { cacheSettings } from "./cache";
export class UsageRecorder {
  readonly settings: ReturnType<typeof cacheSettings>;
  private run: RunUsage;
  private toolsByStep = new Map<number, number>();
  constructor(
    private repo: Repository,
    private owner: string,
    private conversation: string,
    model: string,
    kind: "chat" | "title",
    private pricing: Pricing | null,
    id: string = randomUUID(),
  ) {
    this.settings = cacheSettings(owner, conversation, model, kind);
    this.run = {
      version: 1,
      id,
      kind,
      model,
      status: "pending",
      startedAt: new Date().toISOString(),
      elapsedMs: 0,
      startedSteps: 0,
      toolCalls: 0,
      cachePolicy: this.settings.policy,
      cacheKey: this.settings.key,
      steps: [],
    };
  }
  snapshot(status = this.run.status): RunUsage {
    return {
      ...this.run,
      status,
      elapsedMs: Date.now() - Date.parse(this.run.startedAt),
      steps: [...this.run.steps],
    };
  }
  async start() {
    await this.repo.startUsage(this.owner, this.conversation, this.snapshot());
  }
  private async persist() {
    try {
      await this.repo.saveUsage(this.owner, this.conversation, this.snapshot());
    } catch {
      this.run.persistenceWarning = true;
      console.error(
        JSON.stringify({
          event: "model_usage_save_failed",
          runId: this.run.id,
        }),
      );
    }
  }
  async startStep(index: number) {
    this.run.startedSteps = Math.max(this.run.startedSteps, index + 1);
    await this.persist();
  }
  async step(event: {
    stepNumber: number;
    usage: LanguageModelUsage;
    providerMetadata?: unknown;
    finishReason: string;
    toolCalls: unknown[];
  }) {
    const value = usageStep(
      event.stepNumber,
      this.run.model,
      event.usage,
      event.providerMetadata,
      event.finishReason,
      this.pricing,
    );
    this.run.steps = [
      ...this.run.steps.filter((s) => s.index !== event.stepNumber),
      value,
    ].sort((a, b) => a.index - b.index);
    this.toolsByStep.set(event.stepNumber, event.toolCalls.length);
    this.run.toolCalls = [...this.toolsByStep.values()].reduce(
      (a, b) => a + b,
      0,
    );
    await this.persist();
  }
  async finish(status: Exclude<RunUsage["status"], "pending">) {
    this.run.status = status;
    await this.persist();
    return this.snapshot();
  }
}
export async function startUsage(
  repo: Repository,
  owner: string,
  conversation: string,
  model: string,
  kind: "chat" | "title",
  id?: string,
) {
  const recorder = new UsageRecorder(
    repo,
    owner,
    conversation,
    model,
    kind,
    await modelPricing(model),
    id,
  );
  await recorder.start();
  return recorder;
}
