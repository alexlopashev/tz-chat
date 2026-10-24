import { experimental_codeModeTool as codeModeTool } from "@ai-sdk/code-mode";
import { experimental_getToolCaller } from "@ai-sdk/provider-utils";
import { experimental_toolCaller, type ToolSet } from "ai";
import { isEvidence, type Evidence } from "./evidence";

/** Keep native discovery/caching, retaining authoritative host evidence separately
 * from the sandbox's return value (which may transform or omit that evidence). */
export function researchCodeTool() {
  const native = codeModeTool({
    toolDiscovery: "conversation",
    executionPolicy: {
      timeoutMs: 25_000,
      cpuTimeoutMs: 1_000,
      maxSourceBytes: 16_000,
      maxResultBytes: 250_000,
      maxToolOutputBytes: 500_000,
      maxBridgeRequests: 10,
      maxInFlightBridgeRequests: 2,
    },
  });
  const caller = experimental_getToolCaller(native);
  if (caller?.type !== "local")
    throw new Error("Code mode requires a local caller.");
  return experimental_toolCaller(native, {
    ...caller,
    bind: (tools) => ({
      ...caller.bind(tools),
      execute: async (input, context) => {
        const evidence: Evidence[] = [];
        const tracked: ToolSet = Object.fromEntries(
          Object.entries(tools).map(([name, definition]) => [
            name,
            {
              ...definition,
              execute: async (args, options) => {
                const result = await definition.execute!(args, options);
                if (isEvidence(result)) evidence.push(result);
                return result;
              },
            },
          ]),
        );
        try {
          const result = await caller.bind(tracked).execute!(input, context);
          return { result, evidence };
        } catch {
          return {
            error:
              "Tool execution could not complete. Use retained evidence or try a narrower lookup; do not invent missing data.",
            evidence,
          };
        }
      },
    }),
  });
}
