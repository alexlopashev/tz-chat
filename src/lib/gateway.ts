import "server-only";
import { createGateway } from "@ai-sdk/gateway";
import { gatewayConfig } from "./config";

/** All future model calls use this server-side AI Gateway boundary. */
export function chatModel(modelId?: string) {
  const config = gatewayConfig();
  const gateway = createGateway({ apiKey: config.AI_GATEWAY_API_KEY });
  return gateway(modelId ?? config.AI_GATEWAY_MODEL);
}

// Catalog rates are per token, not per million. A missing rate stays unknown.
let catalog:
  | {
      expires: number;
      models: Awaited<
        ReturnType<ReturnType<typeof createGateway>["getAvailableModels"]>
      >["models"];
    }
  | undefined;
export async function modelPricing(
  modelId: string,
): Promise<import("./usage").Pricing | null> {
  try {
    if (!catalog || catalog.expires < Date.now()) {
      const config = gatewayConfig();
      const gateway = createGateway({
        apiKey: config.AI_GATEWAY_API_KEY,
        fetch: (input, init) =>
          fetch(input, { ...init, signal: AbortSignal.timeout(4000) }),
      });
      const result = await gateway.getAvailableModels();
      catalog = { expires: Date.now() + 600_000, models: result.models };
    }
    const pricing = catalog.models.find(
      (model) => model.id === modelId,
    )?.pricing;
    if (!pricing) return null;
    const { money } = await import("./usage");
    const input = money(pricing.input),
      output = money(pricing.output);
    return input === null || output === null
      ? null
      : {
          input,
          output,
          cacheRead: money(pricing.cachedInputTokens),
          cacheWrite: money(pricing.cacheCreationInputTokens),
          fetchedAt: new Date(catalog.expires - 600_000).toISOString(),
        };
  } catch {
    return null;
  }
}
