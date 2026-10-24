import { afterEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
vi.mock("@ai-sdk/mcp", () => ({
  createMCPClient: vi.fn().mockResolvedValue({}),
}));
import { createMCPClient } from "@ai-sdk/mcp";
import { connectPollingMcp } from "../src/lib/mcp";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});

describe("Explicit per-user MCP credentials", () => {
  it("never falls back to an environment token when the caller omits a credential", async () => {
    vi.stubEnv("RCP_MCP_TOKEN", "synthetic-global-token");
    await expect(
      connectPollingMcp(undefined as unknown as string),
    ).rejects.toThrow("token");
    await expect(connectPollingMcp("")).rejects.toThrow("token");
    expect(createMCPClient).not.toHaveBeenCalled();
  });
  it("sends only the caller's normalized token in the authorization header", async () => {
    vi.stubEnv("RCP_MCP_TOKEN", "synthetic-global-token");
    await connectPollingMcp("Bearer synthetic-user-token");
    expect(createMCPClient).toHaveBeenCalledWith(
      expect.objectContaining({
        transport: expect.objectContaining({
          url: "https://rcp.tazalabs.ai/mcp",
          headers: { Authorization: "Bearer synthetic-user-token" },
        }),
      }),
    );
  });
  it("works without any environment token", async () => {
    vi.stubEnv("RCP_MCP_TOKEN", undefined);
    await expect(
      connectPollingMcp("synthetic-user-token"),
    ).resolves.toBeDefined();
  });
});
