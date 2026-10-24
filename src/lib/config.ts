import { z } from "zod";

export class ConfigurationError extends Error {
  constructor(public readonly fields: string[]) {
    super(`Missing or invalid server configuration: ${fields.join(", ")}`);
    this.name = "ConfigurationError";
  }
}

const nonEmpty = z.string().trim().min(1);
const gatewaySchema = z
  .object({
    AI_GATEWAY_MODEL: nonEmpty.regex(/^[a-z0-9-]+\/[a-zA-Z0-9._:-]+$/),
    AI_GATEWAY_API_KEY: nonEmpty.optional(),
    VERCEL_OIDC_TOKEN: nonEmpty.optional(),
  })
  .refine((env) => Boolean(env.AI_GATEWAY_API_KEY || env.VERCEL_OIDC_TOKEN), {
    path: ["AI_GATEWAY_API_KEY"],
  });
const mcpSchema = z.object({
  url: z.literal("https://rcp.tazalabs.ai/mcp"),
  token: nonEmpty
    .transform((value) => value.replace(/^Bearer(?:\s+|$)/i, "").trim())
    .pipe(z.string().min(1).regex(/^\S+$/)),
});

function parse<T>(
  schema: z.ZodType<T>,
  env: Record<string, string | undefined>,
): T {
  const result = schema.safeParse(
    Object.fromEntries(Object.entries(env).filter(([, value]) => value !== "")),
  );
  if (!result.success) {
    // Report names only. Validation errors must never include credential values.
    throw new ConfigurationError([
      ...new Set(result.error.issues.map((issue) => issue.path.join("."))),
    ]);
  }
  return result.data;
}

export function gatewayConfig(
  env: Record<string, string | undefined> = process.env,
) {
  return parse(gatewaySchema, env);
}
/** User credentials are explicit input, never process-environment configuration. */
export function mcpConfig(input: { url?: string; token?: string }) {
  return parse(mcpSchema, input);
}
