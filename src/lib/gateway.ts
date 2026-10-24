import "server-only";
import { createGateway } from "@ai-sdk/gateway";
import { gatewayConfig } from "./config";

/** All future model calls use this server-side AI Gateway boundary. */
export function chatModel(modelId?: string) {
  const config = gatewayConfig();
  const gateway = createGateway({ apiKey: config.AI_GATEWAY_API_KEY });
  return gateway(modelId ?? config.AI_GATEWAY_MODEL);
}
