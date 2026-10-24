import { jsonSchema, tool, type ToolSet, type JSONSchema7 } from "ai";
import type { MCPClient } from "@ai-sdk/mcp";
import { normalizeEvidence, pollingToolNames } from "./evidence";

export async function pollingTools(client: MCPClient, signal: AbortSignal) {
  const definitions = await client.listTools({ options: { timeout: 10_000 } });
  const tools: ToolSet = {};
  let calls = 0;
  for (const definition of definitions.tools) {
    if (!pollingToolNames.some((name) => name === definition.name)) continue;
    const schema = definition.inputSchema as JSONSchema7;
    const inputSchema = {
      ...schema,
      properties: { ...schema.properties },
      required: schema.required?.filter(
        (key) => key !== "purpose" && key !== "purpose_kind",
      ),
    } as JSONSchema7;
    delete inputSchema.properties?.purpose;
    delete inputSchema.properties?.purpose_kind;
    tools[definition.name] = tool({
      description: definition.description,
      inputSchema: jsonSchema<Record<string, unknown>>(inputSchema),
      execute: async (input) => {
        if (signal.aborted) throw new Error("Research was stopped.");
        if (++calls > 10)
          throw new Error(
            "Research limit reached. Answer using the evidence already retrieved.",
          );
        const args = {
          ...input,
          purpose_kind: "research",
          purpose:
            "Answer a user's polling research question using published RCP data.",
        };
        let result: unknown;
        try {
          result = await client.callTool({
            name: definition.name,
            arguments: args,
            options: { timeout: 12_000 },
          });
        } catch {
          throw new Error(
            "RCP lookup failed or timed out. Reconnect your RCP account if access has expired.",
          );
        }
        return normalizeEvidence(definition.name, input, result);
      },
    });
  }
  if (!Object.keys(tools).length)
    throw new Error("No supported polling tools are available.");
  return tools;
}
