import "server-only";
import {
  ProtectionError,
  dependencyOutcome,
  type SharedProtection,
} from "./protection";
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
  protection?: SharedProtection,
) {
  const config = mcpConfig({
    url: process.env.RCP_MCP_URL ?? "https://rcp.tazalabs.ai/mcp",
    token,
  });
  let rejected = false;
  let protectionError: ProtectionError | undefined;
  try {
    return await createMCPClient({
      transport: {
        type: "http",
        url: config.url,
        headers: { Authorization: `Bearer ${config.token}` },
        fetch: async (input, init) => {
          let finish:
            | ((outcome: "success" | "failure" | "neutral") => Promise<void>)
            | undefined;
          try {
            if (init?.method === "POST")
              finish = await protection?.circuit("mcp");
            const response = await fetch(input, {
              ...init,
              signal: init?.signal
                ? AbortSignal.any([signal, init.signal])
                : signal,
            });
            if (response.status === 401 || response.status === 403)
              rejected = true;
            await finish?.(
              response.status === 429 || response.status >= 500
                ? "failure"
                : response.ok
                  ? "success"
                  : "neutral",
            );
            return response;
          } catch (error) {
            if (error instanceof ProtectionError) protectionError = error;
            await finish?.(dependencyOutcome(error, signal));
            throw error;
          }
        },
      },
    });
  } catch {
    // Never retain an SDK error that may include an authenticated request.
    if (protectionError) throw protectionError;
    throw new McpAccessError(rejected);
  }
}
