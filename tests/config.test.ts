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
  it.each(["test-only", "Bearer test-only", "  bearer   test-only  "])(
    "normalizes raw and prefixed credentials (case %#)",
    (token) => {
      expect(
        mcpConfig({
          url: "https://rcp.tazalabs.ai/mcp",
          token: token,
        }).token,
      ).toBe("test-only");
    },
  );
  it.each(["Bearer", "Bearer   ", "Bearer test\r\nInjected: value"])(
    "rejects empty or malformed authorization values (case %#)",
    (token) => {
      expect(() =>
        mcpConfig({
          url: "https://rcp.tazalabs.ai/mcp",
          token: token,
        }),
      ).toThrow("token");
    },
  );
  it("requires a token and rejects alternate destinations", () => {
    expect(() => mcpConfig({ url: "https://rcp.tazalabs.ai/mcp" })).toThrow(
      /token/,
    );
    expect(() =>
      mcpConfig({
        url: "https://untrusted.example/mcp",
        token: "test-only",
      }),
    ).toThrow(/url/);
  });
  it("never repeats a supplied URL credential in validation errors", () => {
    const secret = "test-sensitive-value";
    try {
      mcpConfig({
        url: `https://rcp.tazalabs.ai/mcp?token=${secret}`,
        token: secret,
      });
      expect.unreachable();
    } catch (error) {
      expect(String(error)).not.toContain(secret);
    }
  });
  it("accepts separate server and credential fields", () => {
    expect(
      mcpConfig({
        url: "https://rcp.tazalabs.ai/mcp",
        token: "test-only",
      }).url,
    ).toBe("https://rcp.tazalabs.ai/mcp");
  });
});
