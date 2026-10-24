import { describe, expect, it } from "vitest";
import { gatewayConfig, mcpConfig } from "../src/lib/config";

describe("AI Gateway configuration", () => {
  it("requires authentication and an explicit model", () => {
    expect(() => gatewayConfig({})).toThrow(/AI_GATEWAY_MODEL/);
    expect(() => gatewayConfig({ AI_GATEWAY_MODEL: "vendor/model" })).toThrow(
      /AI_GATEWAY_API_KEY/,
    );
    expect(() =>
      gatewayConfig({
        AI_GATEWAY_MODEL: "vendor/model",
        AI_GATEWAY_API_KEY: "",
      }),
    ).toThrow();
  });
  it("accepts a local gateway key or Vercel OIDC", () => {
    expect(
      gatewayConfig({
        AI_GATEWAY_MODEL: "vendor/model",
        AI_GATEWAY_API_KEY: "test-only",
      }).AI_GATEWAY_MODEL,
    ).toBe("vendor/model");
    expect(
      gatewayConfig({
        AI_GATEWAY_MODEL: "vendor/model",
        VERCEL_OIDC_TOKEN: "test-only",
      }).VERCEL_OIDC_TOKEN,
    ).toBe("test-only");
  });
});

describe("MCP credential boundary", () => {
  it("requires a token and rejects alternate destinations", () => {
    expect(() =>
      mcpConfig({ RCP_MCP_URL: "https://rcp.tazalabs.ai/mcp" }),
    ).toThrow(/RCP_MCP_TOKEN/);
    expect(() =>
      mcpConfig({
        RCP_MCP_URL: "https://untrusted.example/mcp",
        RCP_MCP_TOKEN: "test-only",
      }),
    ).toThrow(/RCP_MCP_URL/);
  });
  it("never repeats a supplied URL credential in validation errors", () => {
    const secret = "test-sensitive-value";
    try {
      mcpConfig({
        RCP_MCP_URL: `https://rcp.tazalabs.ai/mcp?token=${secret}`,
        RCP_MCP_TOKEN: secret,
      });
      expect.unreachable();
    } catch (error) {
      expect(String(error)).not.toContain(secret);
    }
  });
  it("accepts separate server and credential fields", () => {
    expect(
      mcpConfig({
        RCP_MCP_URL: "https://rcp.tazalabs.ai/mcp",
        RCP_MCP_TOKEN: "test-only",
      }).RCP_MCP_URL,
    ).toBe("https://rcp.tazalabs.ai/mcp");
  });
});
