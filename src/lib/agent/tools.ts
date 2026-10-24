import {
  jsonSchema,
  tool,
  toolSearch,
  type ToolSet,
  type JSONSchema7,
} from "ai";
import type { MCPClient } from "@ai-sdk/mcp";
import { stableObject } from "./cache";
import { normalizeEvidence, pollingToolNames } from "./evidence";

export async function pollingTools(
  client: MCPClient,
  signal: AbortSignal,
): Promise<ToolSet> {
  const definitions = await client.listTools({ options: { timeout: 10_000 } });
  const tools: ToolSet = {};
  let calls = 0;
  for (const definition of [...definitions.tools].sort((a, b) =>
    a.name.localeCompare(b.name),
  )) {
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
      deferLoading: true,
      description: definition.description,
      inputSchema: jsonSchema<Record<string, unknown>>(
        stableObject(inputSchema),
      ),
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
            "RCP lookup could not be completed. The service may be busy or temporarily unavailable; please wait before retrying. Reconnect your RCP account if access has expired.",
          );
        }
        return normalizeEvidence(definition.name, input, result);
      },
    });
  }
  if (!Object.keys(tools).length)
    throw new Error("No supported polling tools are available.");
  return {
    search_tools: toolSearch({ maxResults: 3 }),
    ...tools,
  };
}
