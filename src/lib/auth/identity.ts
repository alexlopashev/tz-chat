import { z } from "zod";

const identity = z.object({ account_id: z.string().uuid() });
/** Only allowlisted identity fields cross the MCP boundary. Never decode the token. */
export function parseIdentity(input: unknown) {
  const result = z
    .object({ isError: z.boolean().optional(), content: z.array(z.unknown()) })
    .parse(input);
  if (result.isError) throw new Error("RCP identity verification failed.");
  const ids = new Set<string>();
  for (const part of result.content) {
    const text = z
      .object({ type: z.literal("text"), text: z.string() })
      .safeParse(part);
    if (!text.success) continue;
    try {
      const parsed = identity.safeParse(JSON.parse(text.data.text));
      if (parsed.success) ids.add(parsed.data.account_id.toLowerCase());
    } catch {
      /* Connection summaries are not identity objects. */
    }
  }
  if (ids.size !== 1)
    throw new Error("RCP did not return a unique account identity.");
  return { userId: [...ids][0] };
}
