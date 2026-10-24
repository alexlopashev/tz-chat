import "server-only";
import { createMCPClient } from "@ai-sdk/mcp";
import { mcpConfig } from "./config";

/**
 * Transport seam only: polling tool schemas and result semantics are not verified.
 * The current server contract uses a query token. Never log this URL or raw errors.
 * Callers must close the client in finally and impose request/tool deadlines.
 */
export async function connectPollingMcp() {
  const config = mcpConfig();
  const url = new URL(config.RCP_MCP_URL);
  url.searchParams.set("token", config.RCP_MCP_TOKEN);
  try {
    return await createMCPClient({
      transport: { type: "http", url: url.toString() },
    });
  } catch {
    throw new Error(
      "Polling MCP connection failed. Check server access and credentials.",
    );
  }
}
