import "server-only";
import { createMCPClient } from "@ai-sdk/mcp";
import { mcpConfig } from "./config";

export class McpAccessError extends Error {
  constructor(public readonly rejected: boolean) {
    super(
      rejected
        ? "RCP rejected the token."
        : "RCP is unavailable. Try again shortly.",
    );
  }
}
/** Callers close the client in finally. Each connection has a bounded deadline. */
export async function connectPollingMcp(
  token: string,
  signal = AbortSignal.timeout(15_000),
) {
  const config = mcpConfig({
    url: process.env.RCP_MCP_URL ?? "https://rcp.tazalabs.ai/mcp",
    token,
  });
  let rejected = false;
  try {
    return await createMCPClient({
      transport: {
        type: "http",
        url: config.url,
        headers: { Authorization: `Bearer ${config.token}` },
        fetch: async (input, init) => {
          const response = await fetch(input, {
            ...init,
            signal: init?.signal
              ? AbortSignal.any([signal, init.signal])
              : signal,
          });
          if (response.status === 401 || response.status === 403)
            rejected = true;
          return response;
        },
      },
    });
  } catch {
    // Never retain an SDK error that may include an authenticated request.
    throw new McpAccessError(rejected);
  }
}
