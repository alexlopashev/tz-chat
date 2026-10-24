import "server-only";
import { createGateway } from "@ai-sdk/gateway";
import { gatewayConfig } from "./config";

/** All future model calls use this server-side AI Gateway boundary. */
export function chatModel() {
  const config = gatewayConfig();
  const gateway = createGateway({ apiKey: config.AI_GATEWAY_API_KEY });
  return gateway(config.AI_GATEWAY_MODEL);
}
